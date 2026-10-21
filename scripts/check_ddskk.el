;;; check_ddskk.el --- Check SKK-JISYO.kaomoji with DDSKK  -*- lexical-binding: t; coding: utf-8 -*-

;; ADR 0002.  Run with:
;;
;;   emacs --batch -Q -L <DDSKK> -l scripts/check_ddskk.el \
;;     --eval '(kaomoji-check "dist/SKK-JISYO.kaomoji" (quote euc-jp) ".cache/check/expected.tsv")'
;;   emacs --batch -Q -L <DDSKK> -l scripts/check_ddskk.el \
;;     --eval '(kaomoji-check-table ".cache/check/euc-jp-table.tsv")'
;;
;; Both functions exit Emacs: 0 when everything matches, 1 otherwise.
;; Mismatches go to standard error, the summary to standard output.

;;; Code:

(require 'skk)
;; DDSKK is loaded from its source directory without building it, so the
;; autoloads that an installed DDSKK has are missing.  Load what the
;; dictionary search calls (numeric conversion is on by default).
(require 'skk-num)
;; DDSKK's binary search compares headwords encoded in emacs-mule
;; (`skk-string<'), and the emacs-mule bytes of hiragana depend on the
;; language environment.  In a bare `emacs -Q' they are encoded as GB 2312,
;; so check in the Japanese environment that DDSKK users have.
(set-language-environment "Japanese")

(defun kaomoji-check--lines (file)
  "Non-empty lines of the UTF-8 FILE."
  (with-temp-buffer
    (let ((coding-system-for-read 'utf-8))
      (insert-file-contents file))
    (split-string (buffer-string) "\n" t)))

(defun kaomoji-check--entry-count (dict coding)
  "Number of okuri-nasi entries in DICT read with CODING."
  (with-temp-buffer
    (let ((coding-system-for-read coding))
      (insert-file-contents dict))
    (goto-char (point-min))
    (unless (search-forward "\n;; okuri-nasi entries.\n" nil t)
      (error "No okuri-nasi entries in %s" dict))
    (let ((count 0))
      (while (not (eobp))
        (unless (or (eolp) (eq (char-after) ?\;))
          (setq count (1+ count)))
        (forward-line 1))
      count)))

(defun kaomoji-check--lookup (dict coding reading)
  "Candidates of READING in DICT as DDSKK shows them.
Searches with binary search (limit 64) and evaluates each candidate
with `skk-eval-string', as DDSKK does before showing it."
  (let ((skk-henkan-key reading))
    (mapcar #'skk-eval-string
            (skk-search-jisyo-file (cons dict coding) 64 'nomsg))))

(defun kaomoji-check--show (strings)
  (mapconcat (lambda (s) (format "%S" s)) strings " "))

(defun kaomoji-check (dict coding expected)
  "Check DICT read with CODING against the EXPECTED TSV, then exit Emacs."
  (let ((rows (mapcar (lambda (line) (split-string line "\t"))
                      (kaomoji-check--lines expected)))
        (failures 0))
    (dolist (row rows)
      (let ((actual (kaomoji-check--lookup dict coding (car row))))
        (unless (equal actual (cdr row))
          (setq failures (1+ failures))
          (message "MISMATCH %s\n  expected: %s\n  actual:   %s"
                   (car row) (kaomoji-check--show (cdr row)) (kaomoji-check--show actual)))))
    (let ((entries (kaomoji-check--entry-count dict coding)))
      (unless (= entries (length rows))
        (setq failures (1+ failures))
        (message "ENTRY COUNT %s has %d entries, expected %d" dict entries (length rows))))
    (princ (format "%s (%s): checked %d readings, %d failure(s)\n" dict coding (length rows) failures))
    (kill-emacs (if (zerop failures) 0 1))))

(defun kaomoji-check--bytes (hex)
  "Unibyte string of the hexadecimal HEX."
  (apply #'unibyte-string
         (mapcar (lambda (i) (string-to-number (substring hex i (+ i 2)) 16))
                 (number-sequence 0 (- (length hex) 2) 2))))

(defun kaomoji-check-table (table)
  "Check that Emacs decodes EUC-JP as TABLE says, then exit Emacs.
TABLE rows are: bytes in hex, the code point Deno maps them to, and
\"differs\" when Emacs is expected to decode them to another character."
  (let ((rows (mapcar (lambda (line) (split-string line "\t"))
                      (kaomoji-check--lines table)))
        (failures 0))
    (dolist (row rows)
      (let* ((deno (string (string-to-number (nth 1 row) 16)))
             (emacs (decode-coding-string (kaomoji-check--bytes (nth 0 row)) 'euc-jp))
             (differs (equal (nth 2 row) "differs")))
        (unless (eq differs (not (equal deno emacs)))
          (setq failures (1+ failures))
          (message "TABLE %s Deno U+%s, Emacs %s, expected to %s"
                   (nth 0 row) (upcase (nth 1 row))
                   (mapconcat (lambda (c) (format "U+%04X" c)) emacs " ")
                   (if differs "differ" "match")))))
    (princ (format "%s: checked %d code points, %d failure(s)\n" table (length rows) failures))
    (kill-emacs (if (zerop failures) 0 1))))

(provide 'check_ddskk)

;;; check_ddskk.el ends here

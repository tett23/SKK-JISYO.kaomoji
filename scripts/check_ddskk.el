;;; check_ddskk.el --- Check SKK-JISYO.kaomoji with DDSKK  -*- lexical-binding: t; coding: utf-8 -*-

;; ADR 0002, ADR 0003 and ADR 0004.  Run with:
;;
;;   emacs --batch -Q -L <DDSKK> -l scripts/check_ddskk.el \
;;     --eval '(kaomoji-check "dist/SKK-JISYO.kaomoji" (quote euc-jp) ".cache/check/expected.tsv")'
;;   emacs --batch -Q -L <DDSKK> -l scripts/check_ddskk.el \
;;     --eval '(kaomoji-check-order "dist/SKK-JISYO.kaomoji" (quote euc-jp) (quote ddskk))'
;;   emacs --batch -Q -L <DDSKK> -l scripts/check_ddskk.el \
;;     --eval '(kaomoji-check-table ".cache/check/euc-jp-table.tsv")'
;;
;; These functions exit Emacs: 0 when everything matches, 1 otherwise.
;; Mismatches go to standard error, the summary to standard output.

;;; Code:

(require 'cl-lib)
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

(defconst kaomoji-check-limit 10000
  "Binary search limit.  DDSKK uses 10000 for `skk-large-jisyo' and
`skk-extra-jisyo-file-list' (`skk-search-prog-list').")

(defun kaomoji-check--lines (file)
  "Non-empty lines of the UTF-8 FILE."
  (with-temp-buffer
    (let ((coding-system-for-read 'utf-8))
      (insert-file-contents file))
    (split-string (buffer-string) "\n" t)))

(defun kaomoji-check--headwords (dict coding)
  "Okuri-nasi headwords of DICT read with CODING, in file order."
  (with-temp-buffer
    (let ((coding-system-for-read coding))
      (insert-file-contents dict))
    (goto-char (point-min))
    (unless (search-forward "\n;; okuri-nasi entries.\n" nil t)
      (error "No okuri-nasi entries in %s" dict))
    (let (headwords)
      (while (not (eobp))
        (unless (or (eolp) (eq (char-after) ?\;))
          (push (buffer-substring-no-properties (point) (1- (search-forward " " (line-end-position))))
                headwords))
        (forward-line 1))
      (nreverse headwords))))

(defun kaomoji-check--lookup (dict coding reading limit)
  "Candidates of READING in DICT as DDSKK shows them.
Searches with LIMIT (DDSKK uses `kaomoji-check-limit') and evaluates each candidate
with `skk-eval-string', as DDSKK does before showing it."
  (let ((skk-henkan-key reading))
    (mapcar #'skk-eval-string
            (skk-search-jisyo-file (cons dict coding) limit 'nomsg))))

(defun kaomoji-check--show (strings)
  (mapconcat (lambda (s) (format "%S" s)) strings " "))

(defun kaomoji-check (dict coding expected &optional limit)
  "Check DICT read with CODING against the EXPECTED TSV, then exit Emacs.
LIMIT defaults to `kaomoji-check-limit'.  Pass 0 (linear search only) for
the UTF-8 version, whose UTF-8 byte order is not DDSKK's order (ADR 0004)."
  (let ((limit (or limit kaomoji-check-limit))
        (rows (mapcar (lambda (line) (split-string line "\t"))
                      (kaomoji-check--lines expected)))
        (failures 0))
    (dolist (row rows)
      (let ((actual (kaomoji-check--lookup dict coding (car row) limit)))
        (unless (equal actual (cdr row))
          (setq failures (1+ failures))
          (message "MISMATCH %s\n  expected: %s\n  actual:   %s"
                   (car row) (kaomoji-check--show (cdr row)) (kaomoji-check--show actual)))))
    (let ((entries (length (kaomoji-check--headwords dict coding))))
      (unless (= entries (length rows))
        (setq failures (1+ failures))
        (message "ENTRY COUNT %s has %d entries, expected %d" dict entries (length rows))))
    (princ (format "%s (%s, limit %d): checked %d readings, %d failure(s)\n"
                   dict coding limit (length rows) failures))
    (kill-emacs (if (zerop failures) 0 1))))

(defun kaomoji-check--less-p (order a b)
  "Non-nil if headword A sorts before B in ORDER (`ddskk' or `utf-8')."
  (pcase order
    ('ddskk (skk-string< a b))
    ('utf-8 (string< (encode-coding-string a 'utf-8) (encode-coding-string b 'utf-8)))
    (_ (error "Unknown order %S" order))))

(defun kaomoji-check-order (dict coding order)
  "Check that the headwords of DICT read with CODING ascend in ORDER, then exit Emacs.
ORDER is `ddskk' (`skk-string<', what DDSKK's binary search uses) or
`utf-8' (UTF-8 bytes, what libskk uses for a UTF-8 dictionary)."
  (let ((headwords (kaomoji-check--headwords dict coding))
        (failures 0))
    (cl-loop for (a b) on headwords
             while b
             unless (kaomoji-check--less-p order a b)
             do (setq failures (1+ failures))
             (message "ORDER %s %s" a b))
    (princ (format "%s (%s): checked the %s order of %d headwords, %d failure(s)\n"
                   dict coding order (length headwords) failures))
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

"""Spreadsheet Classroom Challenge
Blind timer + interactive Spreadsheet Jeopardy.
Run with: python classroom_tools.py
Uses only Python's standard-library Tkinter.
"""

import time
import tkinter as tk
from tkinter import ttk, messagebox, font

CATEGORIES = [
    ("EXCEL ESSENTIALS", [
        (100, "What character must appear first when you enter a formula in Excel?", "The equals sign: ="),
        (200, "What is the address of the cell in column D and row 7?", "D7"),
        (300, "What Excel feature lets you continue a number pattern or copy a formula by dragging?", "The fill handle (AutoFill)."),
        (400, "When a cell displays 37 but the formula bar shows =3*A10+7, what is actually stored in the cell?", "The formula =3*A10+7. Excel displays the calculated result, 37."),
        (500, "Which Excel error usually appears when a formula divides by zero?", "#DIV/0!"),
    ]),
    ("FORMULA FACTORY", [
        (100, "Write an Excel formula that multiplies the value in A2 by 5.", "=5*A2"),
        (200, "Fixed cost is in H6, variable cost per item is in H7, and quantity is in A6. Write C = F + vn.", "=$H$6+$H$7*A6"),
        (300, "Write the Excel formula for the mean of values in B7 through B36.", "=AVERAGE(B7:B36)"),
        (400, "Write the Excel formula for the sample standard deviation of B7 through B36.", "=STDEV.S(B7:B36)"),
        (500, "Excel has no simple RANGE function for statistical range. Write a formula for range using B7:B36.", "=MAX(B7:B36)-MIN(B7:B36)"),
    ]),
    ("REFERENCE RANGERS", [
        (100, "Which is a relative reference: A2 or $A$2?", "A2"),
        (200, "Which is an absolute reference: A2 or $A$2?", "$A$2"),
        (300, "Cell B2 contains =3*A2+7. If it is copied down to B5, what formula should appear?", "=3*A5+7"),
        (400, "DAILY DOUBLE: A formula is =$E$1*A2+$E$2. When it is filled down, which references stay fixed?", "$E$1 and $E$2 stay fixed. The A2 reference changes row as the formula moves."),
        (500, "What does the mixed reference $A2 mean?", "Column A is locked, but the row is allowed to change."),
    ]),
    ("STAT ATTACK", [
        (100, "Which Excel function calculates the arithmetic mean?", "=AVERAGE(range)"),
        (200, "Which measure of center is the middle observation after the data are ordered?", "The median."),
        (300, "If the standard deviation of a dataset is 0, what must be true about the observations?", "All observations are identical."),
        (400, "Which function is normally used for the sample standard deviation in this class?", "=STDEV.S(range)"),
        (500, "A dataset contains one very large outlier. Which is usually affected more: the mean or the median?", "The mean is affected more. The median is more resistant to an extreme value."),
    ]),
    ("CHARTS & DATA", [
        (100, "Which chart is usually best for plotting numerical x-y pairs?", "An XY scatter plot."),
        (200, "What does a histogram show?", "How numerical observations are distributed across intervals (bins), using frequencies or counts."),
        (300, "Why can a scatter plot be better than a line chart when x-values are irregularly spaced?", "A scatter plot uses the actual numerical x-values and their spacing; a standard line chart often treats x-values as categories."),
        (400, "A histogram is tightly clustered and the standard deviation is small. What does that suggest?", "The observations are relatively consistent and have little spread around their center."),
        (500, "In the 10-second experiment, the mean signed error is +0.8 seconds. What does the positive bias mean?", "The class overestimated 10 seconds by 0.8 seconds on average."),
    ]),
]

FINAL_Q = (
    "A dataset has mean 2.54, median 2.48, and most observations between 2.3 and 2.6, "
    "but one observation is 3.85.\n\nWhat feature of the data explains the mean being above "
    "the median, and which measure of center is more resistant to that feature?"
)
FINAL_A = (
    "The 3.85 observation is a large right-side outlier. It pulls the mean upward.\n\n"
    "The median is more resistant to an extreme value."
)


class BlindTimer(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent, padding=28)
        self.started = None
        self.target_value = None

        ttk.Label(self, text="Blind Timing Experiment",
                  font=("Segoe UI", 24, "bold")).pack(pady=(0, 6))
        ttk.Label(
            self,
            text="Press Start, then press Stop when you think the target time has passed.\n"
                 "The running seconds are intentionally hidden.",
            justify="center",
            font=("Segoe UI", 11),
        ).pack(pady=(0, 22))

        row = ttk.Frame(self)
        row.pack()
        ttk.Label(row, text="Target time (seconds):",
                  font=("Segoe UI", 11, "bold")).pack(side="left", padx=(0, 10))
        self.target = tk.StringVar(value="10")
        self.entry = ttk.Entry(row, textvariable=self.target, width=10,
                               font=("Segoe UI", 12))
        self.entry.pack(side="left")

        self.status = ttk.Label(self, text="Ready.",
                                font=("Segoe UI", 26, "bold"), anchor="center")
        self.status.pack(fill="x", pady=(36, 5))
        self.note = ttk.Label(self, text="Set a target, then press Start.",
                              font=("Segoe UI", 12), anchor="center")
        self.note.pack(fill="x", pady=(0, 28))

        buttons = ttk.Frame(self)
        buttons.pack()
        self.start_btn = ttk.Button(buttons, text="Start", command=self.start)
        self.start_btn.pack(side="left", padx=6)
        self.stop_btn = ttk.Button(buttons, text="Stop", command=self.stop,
                                   state="disabled")
        self.stop_btn.pack(side="left", padx=6)
        ttk.Button(buttons, text="New Attempt",
                   command=self.reset).pack(side="left", padx=6)

        self.result = ttk.Label(self, text="", justify="center",
                                font=("Segoe UI", 13, "bold"))
        self.result.pack(pady=(28, 0))

    def start(self):
        try:
            target = float(self.target.get())
            if target <= 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Invalid target",
                                 "Enter a target greater than 0 seconds.")
            return

        self.target_value = target
        self.started = time.perf_counter()
        self.status.config(text="Timing started.")
        self.note.config(text=f"Press Stop when you think {target:g} seconds have passed.")
        self.result.config(text="")
        self.start_btn.config(state="disabled")
        self.stop_btn.config(state="normal")
        self.entry.config(state="disabled")

    def stop(self):
        if self.started is None:
            return
        elapsed = time.perf_counter() - self.started
        error = elapsed - self.target_value
        absolute = abs(error)
        direction = "late" if error >= 0 else "early"

        self.status.config(text=f"You achieved {elapsed:.2f} seconds.")
        self.note.config(text=f"You stopped {absolute:.2f} seconds {direction}.")
        self.result.config(
            text=f"Target: {self.target_value:.2f} s     "
                 f"Signed error: {error:+.2f} s     "
                 f"Absolute error: {absolute:.2f} s"
        )
        self.started = None
        self.start_btn.config(state="normal")
        self.stop_btn.config(state="disabled")
        self.entry.config(state="normal")

    def reset(self):
        self.started = None
        self.target_value = None
        self.status.config(text="Ready.")
        self.note.config(text="Set a target, then press Start.")
        self.result.config(text="")
        self.start_btn.config(state="normal")
        self.stop_btn.config(state="disabled")
        self.entry.config(state="normal")


class Jeopardy(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent, padding=18)
        self.buttons = {}
        self.fonts = {}
        self.make_board()

    def make_board(self):
        top = ttk.Frame(self)
        top.grid(row=0, column=0, columnspan=5, sticky="ew", pady=(0, 12))
        ttk.Label(top, text="Spreadsheet Jeopardy",
                  font=("Segoe UI", 24, "bold")).pack(side="left")
        ttk.Button(top, text="Reset Board",
                   command=self.reset_board).pack(side="right")

        for col, (category, _) in enumerate(CATEGORIES):
            tk.Label(
                self, text=category, bg="#102d65", fg="white",
                font=("Segoe UI", 11, "bold"), wraplength=150,
                padx=8, pady=14
            ).grid(row=1, column=col, sticky="nsew", padx=4, pady=4)
            self.columnconfigure(col, weight=1, uniform="board")

        for row in range(5):
            self.rowconfigure(row + 2, weight=1, uniform="board")
            for col, (category, clues) in enumerate(CATEGORIES):
                value, question, answer = clues[row]
                tile_font = font.Font(family="Segoe UI", size=18, weight="bold")
                button = tk.Button(
                    self, text="$" + str(value), bg="#15397f", fg="#f1c75b",
                    activebackground="#1e4d91", activeforeground="#f1c75b",
                    font=tile_font, relief="raised", bd=1,
                    command=lambda c=col, r=row, cat=category, v=value,
                                   q=question, a=answer:
                                   self.open_clue(c, r, cat, v, q, a)
                )
                button.grid(row=row + 2, column=col, sticky="nsew",
                            padx=4, pady=4, ipady=14)
                self.buttons[(col, row)] = button
                self.fonts[(col, row)] = tile_font

        ttk.Button(self, text="FINAL JEOPARDY",
                   command=self.open_final).grid(
            row=7, column=0, columnspan=5, sticky="ew", pady=(12, 0), ipady=8
        )

    def open_clue(self, col, row, category, value, question, answer):
        key = (col, row)
        self.fonts[key].configure(overstrike=1)
        self.buttons[key].config(bg="#43516d", fg="#a9b1bf", relief="sunken")
        self.question_window(category, "$" + str(value), question, answer)

    def question_window(self, category, value, question, answer):
        win = tk.Toplevel(self)
        win.title(f"{category} {value}")
        win.geometry("760x470")
        win.minsize(620, 380)
        win.transient(self.winfo_toplevel())
        win.grab_set()

        frame = ttk.Frame(win, padding=28)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text=category,
                  font=("Segoe UI", 11, "bold")).pack(anchor="w")
        ttk.Label(frame, text=value,
                  font=("Segoe UI", 24, "bold")).pack(anchor="w", pady=(0, 18))
        ttk.Label(frame, text=question, wraplength=680, justify="left",
                  font=("Segoe UI", 16)).pack(anchor="w")

        answer_label = ttk.Label(
            frame, text="", wraplength=680, justify="left",
            font=("Segoe UI", 13, "bold")
        )
        answer_label.pack(anchor="w", pady=(25, 0))

        def toggle():
            if answer_label.cget("text"):
                answer_label.config(text="")
                reveal.config(text="Show Solution")
            else:
                answer_label.config(text="Solution:\n" + answer)
                reveal.config(text="Hide Solution")

        controls = ttk.Frame(frame)
        controls.pack(side="bottom", fill="x", pady=(25, 0))
        reveal = ttk.Button(controls, text="Show Solution", command=toggle)
        reveal.pack(side="left")
        ttk.Button(controls, text="Back to Board",
                   command=win.destroy).pack(side="right")

    def open_final(self):
        self.question_window("FINAL JEOPARDY", "Wager", FINAL_Q, FINAL_A)

    def reset_board(self):
        if not messagebox.askyesno("Reset board",
                                   "Reset every value so the game can be played again?"):
            return
        for key, button in self.buttons.items():
            self.fonts[key].configure(overstrike=0)
            button.config(bg="#15397f", fg="#f1c75b", relief="raised")


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Spreadsheet Classroom Challenge")
        self.geometry("1180x760")
        self.minsize(940, 650)
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        tabs = ttk.Notebook(self)
        tabs.pack(fill="both", expand=True)
        tabs.add(BlindTimer(tabs), text="Blind Timer")
        tabs.add(Jeopardy(tabs), text="Spreadsheet Jeopardy")


if __name__ == "__main__":
    App().mainloop()

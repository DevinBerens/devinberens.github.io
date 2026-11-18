#!/usr/bin/env python3
"""Background kitchen timer: python3 timer.py 10 "pasta"  (minutes, label). Speaks when done."""
import subprocess
import sys

minutes = float(sys.argv[1])
label = " ".join(sys.argv[2:]) or "timer"
subprocess.Popen(
    ["sh", "-c", f'sleep {int(minutes * 60)}; say "Your {label} timer is done"'],
    start_new_session=True,
)
print(f"Timer set: {label}, {minutes:g} min")

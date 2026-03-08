- [x] TASK-1: Allow interacive mode for "add-task" command.
When add-task is called with no arguments (no task description)
Open a text based editor which allows to write the task content.
The editor should be implemented in pure typescript and should not use
any NPM deps.
It should allow easy navigation with arrow keys,
should support tab and backspace.
Once the user finishes editing, the task can be added to the tracker as it is usually done with
add task today.

- [x] TASK-2: Unfortunately, I can't see the cursor in the add-task interactive editor.
Can this be fixed?

- [x] TASK-3: Visible cursor is out of sync of the actual editing position after using tab.
When I used "tab", the visible cursor moved 1 step to the right, but it became out of sync comparing to the actual editing positio.
The same thing happened when I changed the window size.

- [x] TASK-4: Text wrappig cursor position issue
When long line of text is typed, when the cursor reaches the end of the window it stays there and the text is typed in the next line.

- [ ] TASK-5: Allow file / folder name auto completion
When the user types @ and starts typing, show auto completion pop up that allows him to choose a file or folder full path out of all the existing files / folders under the current folder

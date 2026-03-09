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

- [x] TASK-5: Allow file / folder name auto completion
When the user types @ and starts typing, show auto completion pop up that allows him to choose a file or folder full path out of all the existing files / folders under the current folder

- [x] TASK-6: In the files auto completion, do not show the full path of the file, just the relative path to the current folder. Also when the file is selected, write the relative path in the editor.

- [x] TASK-7: The file auto completion list should be the minimum 5, maximum, the height
between the cursor y position and the bottom of the window

- [x] TASK-8: When I write the first characted after the @ everything gets wierd (I see the popup title overriding my text) but after the second character is typed, it gets to a better state.

- [x] TASK-9: Can we make the height of the auto completion list be lower by 2?
so it will be max(5, screen_max_y-cursor_y-2)

- [x] TASK-10: Make the filename auto completion case in-sensitive

- [x] TASK-11: Look at all the tasks in the tracker .bman/tracker/add_task_interactive/tasks.md
And also look at the code of src/textEditor.ts
And write a test that ensures it works according to all the things we defined.

You can also refactor its code to allow mocking stdin and fs, etc

- [x] TASK-12: There are very few tests in tests/textEditor.test.ts.
Can we make sure that it covers all the functionality of src/textEditor.ts?

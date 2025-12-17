After a task is resolved, run all tests (npm test), run lint (npm run lint:fix) and fix issues if any.

- [x] TASK-1: Add "add-task" command to the cli
Usage:
bmad-dev-agent add-task "Description"
This should automatically create the relevant tracker if not exit (named after the current branch as usual)
then add the new task to the bottom of the tasks list and give it a number (+1 of the last task number)

- [x] TASK-2: Cover add-task CLI command with tests

- [x] TASK-3: Change usage such that the options will be related to the specific command
* --all and --push are relevant only for "resolve" for example

- [ ] TASK-4: The function addTask must not be defined in cli.ts. It belongs to the tracker module. The tracker module shoud expose addTask function as part of its interface - update types.ts if needed.

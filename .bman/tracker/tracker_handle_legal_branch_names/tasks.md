- [x] TASK-1: Handle all possible branch names in tracker:
Add tests and fix impl if needed
the CLI add-task (and the tracker module in general) should support all the possible branch names
For example, if the branch name is ai/brrr then we may not be able to create a directory named ai/brrr, so there is a need to replace the "/" with another character for the name of the tracker file.
Make sure you investigate the possible branch name special characters,
You find a solution to the tracker folder naming.
You add tests to all the new scenarios.

- [x] TASK-1: Document how to use bman-dev-agent in CI (in readme.md)
Basically, you should provide a simple example to a github actions workflow that also runs bman-dev-agent.
Let's assue that it can be installed via
npm i -g @b-man/bman-dev-agent
Then, document about how to add codex API key as a CI secret that will be exposed as env variable to the script.
Suggest to run a simple CI workflow that looks like this:
1. Clone the repo
2. Install the nessecary tools to build and run tests (e.g. node / C# / Java)
3. Run a build (without running all tests) just to verify that everything compiles
4. Run bman-dev-agent --all --push (make sure that the action has push permissions)
5. Based on the bman-dev-agent exit code, fail or pass the build.
After this action is set up, the user can decide if it should run on all branches with some prefix
or just to be triggered manually on some branch (safer).
Point out that when it runs on a branch, it will potentially work on all the open tasks in the branch, sequentially, and will perform commit and push for each task. If a blocked task is reached, it will commit and push it and then fail the build. We insist on committing and pushing blocked task (if possible) because it exposes the issues in the implementation and AI thoughts.

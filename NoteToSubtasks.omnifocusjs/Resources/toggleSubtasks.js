/* global PlugIn */
(() => {

  const action = new PlugIn.Action(function (selection, sender) {
    const lib = this.noteToSubtasksLib
    const task = selection.tasks[0]
    if (lib.canBeExpanded(task)) {
      lib.noteToSubtasks(task)
    } else {
      lib.collapseSubtasks(task)
    }
  })

  action.validate = function (selection, sender) {
    if (selection.tasks.length !== 1) return false

    const lib = this.noteToSubtasksLib
    const task = selection.tasks[0]
    return lib.canBeExpanded(task) || lib.canBeCollapsed(task)
  }

  return action
})()

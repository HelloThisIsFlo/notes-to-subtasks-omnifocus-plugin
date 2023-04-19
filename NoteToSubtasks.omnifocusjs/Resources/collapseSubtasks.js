/* global PlugIn */
(() => {
  const action = new PlugIn.Action(function (selection, sender) {
    this.noteToSubtasksLib.collapseSubtasks(selection.tasks[0])
  })

  action.validate = function (selection, sender) {
    if (selection.tasks.length !== 1) return false

    const task = selection.tasks[0]
    return this.noteToSubtasksLib.canBeCollapsed(task)
  }

  return action
})()

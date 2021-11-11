/* global PlugIn Form flattenedTags */
(() => {
  const action = new PlugIn.Action(async function (selection, sender) {
    const preferences = this.noteToSubtasksLib.loadSyncedPrefs()

    // get current preferences or set defaults if they don't yet exist
    const checklistTag = this.noteToSubtasksLib.getChecklistTag()

    // create and show form
    const form = new Form()
    const checklistTagField = new Form.Field.Option('checklistTagID', 'Checklist Tag', flattenedTags, flattenedTags.map(t => t.name), checklistTag)
    checklistTagField.allowsNull = true
    checklistTagField.nullOptionTitle = 'None'
    form.addField(checklistTagField)

    await form.show('Preferences: Note To Subtasks', 'OK')

    // save preferences
    if (form.values.checklistTagID !== null) preferences.write('checklistTagID', form.values.checklistTagID.id.primaryKey)
  })

  action.validate = function (selection, sender) {
    // only show when nothing is selected
    return selection.tasks.length === 0 && selection.projects.length === 0
  }

  return action
})()
/* global PlugIn Version Tag duplicateTasks Pasteboard copyTasksToPasteboard deleteObject moveTasks TypeIdentifier pasteTasksFromPasteboard Alert */
(() => {
  const lib = new PlugIn.Library(new Version('1.0'))

  const TEMPLATE_REGEX = /^\$TEMPLATE=(.*?)$/gm
  const SEPARATOR = '==== Note To Subtasks ===='
  const SEPARATOR_REGEX = new RegExp(`^${SEPARATOR}`, 'm')
  const ENDING_CHECKMARK = ' ✔';
  const ENDING_CHECKMARK_REGEX = new RegExp(`${ENDING_CHECKMARK}$`);
  const REPEATING_COLLAPSE_WARNING = '\n[ ] ⚠️ REPEATING TASK - Collapse before completing! ⚠️'

  lib.loadSyncedPrefs = () => {
    const syncedPrefsPlugin = PlugIn.find('com.KaitlinSalzke.SyncedPrefLibrary')

    if (syncedPrefsPlugin !== null) {
      const SyncedPref = syncedPrefsPlugin.library('syncedPrefLibrary').SyncedPref
      return new SyncedPref('com.KaitlinSalzke.noteToSubtasks')
    } else {
      const alert = new Alert(
        'Synced Preferences Library Required',
        'For the Note To Subtasks plug-in to work correctly, the \'Synced Preferences for OmniFocus\' plug-in (https://github.com/ksalzke/synced-preferences-for-omnifocus) is also required and needs to be added to the plug-in folder separately. Either you do not currently have this plug-in installed, or it is not installed correctly.'
      )
      alert.show()
    }
  }

  lib.getChecklistTag = () => {
    const preferences = lib.loadSyncedPrefs()
    const id = preferences.read('checklistTagID')
    return (id === null) ? null : Tag.byIdentifier(id)
  }

  lib.getExpandableTag = () => {
    const preferences = lib.loadSyncedPrefs()
    const id = preferences.read('expandableTagID')
    return (id === null) ? null : Tag.byIdentifier(id)
  }

  lib.getUninheritedTags = () => {
    const preferences = lib.loadSyncedPrefs()
    return (preferences.read('uninheritedTagIDs') !== null) ? preferences.read('uninheritedTagIDs').map(id => Tag.byIdentifier(id)).filter(tag => tag !== null) : []
  }

  lib.getTagsToRemove = () => {
    const preferences = lib.loadSyncedPrefs()
    return (preferences.read('tagsToRemoveIDs') !== null) ? preferences.read('tagsToRemoveIDs').map(id => Tag.byIdentifier(id)).filter(tag => tag !== null) : []
  }

  lib.templateToSubtasks = async function (task, templateName) {
    const templateLib = PlugIn.find('com.KaitlinSalzke.Templates').library('templateLibrary')

    if (templateLib !== null) {
      const templateFolder = await templateLib.getTemplateFolder()
      const template = templateFolder.flattenedProjects.find(project => project.name === templateName)
      templateLib.createFromTemplate(template, task)
    } else {
      const alert = new Alert('Templates Not Installed', 'Trying to create from template but Templates plug-in is not installed. Find at https://github.com/ksalzke/templates-for-omnifocus')
      alert.show()
    }
  }

  lib.canBeExpanded = function (task) {
    return (task.note.match(SEPARATOR_REGEX) || [...task.note.matchAll(TEMPLATE_REGEX)]?.length === 1)
      && task.children.length === 0 
      && task.taskStatus !== Task.Status.Completed
      && task.taskStatus !== Task.Status.Dropped
  }
  lib.canBeCollapsed = function (task) {
    return !SEPARATOR_REGEX.test(task.note) && task.children.length !== 0
  }

  lib.noteToSubtasks = function (task) {
    if (!lib.canBeExpanded(task)) return;
    const checklistTag = lib.getChecklistTag()
    const uninheritedTags = lib.getUninheritedTags()
    const tagsToRemove = lib.getTagsToRemove()
    const tagSubtasks = (task) => task.flattenedTasks.forEach(subtask => {
      // function to add checklist tag and remove uninherited tags
      if (checklistTag !== null) subtask.addTag(checklistTag)
      subtask.addTags(task.tags)
      subtask.removeTags(uninheritedTags)
    })
    

    // create from template if applicable
    const templateNameMatches = [...task.note.matchAll(TEMPLATE_REGEX)]
    if (templateNameMatches?.length === 1) {
      const templateName = templateNameMatches[0][1];
      lib.templateToSubtasks(task, templateName);
      task.note = task.note.replace(TEMPLATE_REGEX, '')
      tagSubtasks(task)
      return
    }


    // Extract the data & remove from the note
    const [note, subtasksData] = task.note.split(SEPARATOR_REGEX)
    task.note = note

    // Remove checkmark from the name
    if (ENDING_CHECKMARK_REGEX.test(task.name)) task.name = task.name.replace(ENDING_CHECKMARK_REGEX, '')



    // mark parent task as completed when all children are completed
    task.completedByChildren = true


    // stop if no TaskPaper and no template found
    const regex = /^.*?(?=_*\[\s\]|_*-\s)/gs
    if (!regex.test(subtasksData)) {
      return
    }

    // ignore everything up to first '[ ]' or '- ' or '_'' in TaskPaper
    let taskpaper = subtasksData.replace(regex, '')

    // get note and replace underscores before "[" with tabs -- needed because Shortcut removes tabs from Drafts template
    taskpaper = taskpaper.replace(/(_)+(?=\[)/g, function (match) {
      const underscoreLength = match.length
      const replacement = '\t'.repeat(underscoreLength)
      return replacement
    })

    // Remove nested checklists
    const nestedChecklistRegex = new RegExp(`(\[ \].*)${ENDING_CHECKMARK}((.*\n)*?)^\t+${SEPARATOR}`, 'm')
    while (nestedChecklistRegex.test(taskpaper)) {
      taskpaper = taskpaper.replace(nestedChecklistRegex, '$1$2')
    }

    // if task is a repeating task, add extra task to instruct to collapse before completing
    if (task.repetitionRule !== null) {
      taskpaper += REPEATING_COLLAPSE_WARNING
    }

    // replace '[ ]' with '-'
    taskpaper = taskpaper.replace(/\[\s\]/g, ' - ')

    // replace '( )' with '[ ]'
    taskpaper = taskpaper.replace(/\(\s\)/g, '[ ]')

    // replace '< >' with '( )'
    taskpaper = taskpaper.replace(/<\s>/g, '( )')


    // create subtasks
    const subtaskPasteboard = Pasteboard.makeUnique()
    subtaskPasteboard.string = taskpaper
    const newTasks = pasteTasksFromPasteboard(subtaskPasteboard)
    moveTasks(newTasks, task.ending)

    // add checklist tag and remove uninherited tags
    tagSubtasks(task)

    // check if there is only one subtask now and if so expand it too
    if (task.children.length === 1) {
      this.noteToSubtasks(task.children[0])
    }
  }

  lib.collapseSubtasks = function (task) {
    // make sure parent task isn't set to autocomplete so that it isn't marked complete when collapsed
    task.completedByChildren = false

    const tempPasteboard = Pasteboard.makeUnique()
    copyTasksToPasteboard(task.children, tempPasteboard)
    const subtasksData = tempPasteboard.string
                          .replace(/^(\t*)- /gm, '$1[ ] ')
                          .replace(REPEATING_COLLAPSE_WARNING, '')

    task.note = 
    `
${task.note}
${SEPARATOR}
${subtasksData}
    `
    if (!ENDING_CHECKMARK_REGEX.test(task.name)) task.name = task.name + ENDING_CHECKMARK;

    if (lib.getExpandableTag() !== null) task.addTag(lib.getExpandableTag())

    task.children.forEach(child => deleteObject(child))
  }

  return lib
})()

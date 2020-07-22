const notepad = (function() {
    const defaultHeight = window.innerHeight * 0.3;
    let notepadData = recall('notepadData') || {contents: '', stowed: true, unstowedHeight: defaultHeight};

    const notepad = document.createElement('div');
    notepad.id = 'notepad';
    notepad.classList.add('unstowed');

    const notepadToggle = document.createElement('div');
    notepadToggle.id = 'notepad_toggle';

    const notepadArrow = document.createElement('div');
    notepadArrow.id = 'notepad_arrow';

    const notepadLabel = document.createElement('span');
    notepadLabel.id = 'notepad_label';
    notepadLabel.innerText = 'Notes';

    const notepadTextarea = document.createElement('textarea');
    notepadTextarea.id = 'notepad_textarea';

    notepad.appendChild(notepadArrow);
    notepad.appendChild(notepadToggle);
    notepadToggle.appendChild(notepadLabel);
    notepad.appendChild(notepadTextarea);

    const cssReady = new Promise(function(resolve, reject) {
        $(document).ready(function() {
            resolve();
        });
    });

    let offsetY = 0;
    let resizing = false;

    // Stow notes
    function stow() {
        notepad.style.height = getComputedStyle(notepad).getPropertyValue('--notepad-toggle-height');
        notepadData.stowed = true;
        notepad.classList.remove('unstowed');
        notepad.classList.add('stowed');
    }

    // Unstow notes
    function unstow() {
        notepad.style.height = notepadData.unstowedHeight + 'px';
        notepadData.stowed = false;
        notepad.classList.remove('stowed');
        notepad.classList.add('unstowed');
    }

    // Handle mousemove and touchmove events to resize notes
    function resize(e) {
        //console.log(e.type);
        if (!notepad.classList.contains('notransition')) {
            notepad.classList.add('notransition');
        }
        if (notepadData.stowed) {
            unstow();
        }
        let pageY = e.type === 'mousemove' ? e.pageY : e.touches[0].pageY;
        let notepadToggleHeight = parseInt(getComputedStyle(notepad).getPropertyValue('--notepad-toggle-height'));
        let newHeight = Math.min(Math.max(notepad.getBoundingClientRect().bottom - pageY + offsetY, notepadToggleHeight), window.innerHeight);
        if (newHeight < notepadToggleHeight + 10) {
            notepadData.unstowedHeight = defaultHeight;
            stow();
        } else {
            notepad.style.height = newHeight + 'px';
            notepadData.unstowedHeight = Math.max(newHeight, defaultHeight);
        }
        e.preventDefault();
    }

    // Handle mouseup and touchend events to remove mousemove, touchmove, mouseup, and touchend event listeners
    function mouseup(e) {
        //console.log(e.type);
        if (notepad.classList.contains('notransition')) {
            notepad.classList.remove('notransition');
        } else {
            if (notepadData.stowed) {
                unstow();
            } else {
                stow();
            }
        }
        if (e.type === 'mouseup') {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', mouseup);
        } else {
            window.removeEventListener('touchmove', resize);
            window.removeEventListener('touchend', mouseup);
        }
        e.preventDefault();
    }

    // Handle mousedown and touchstart events to add mousemove, touchmove, mouseup, and touchend event listeners
    function mousedown(e) {
        //console.log(e.type);
        if (e.type === 'mousedown') {
            offsetY = e.offsetY;
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', mouseup);
        } else {
            offsetY = 0;
            window.addEventListener('touchmove', resize);
            window.addEventListener('touchend', mouseup);
        }
        e.preventDefault();
    }

    notepadToggle.addEventListener('mousedown', mousedown);
    notepadToggle.addEventListener('touchstart', mousedown);

    function init() {
        // Handle default notepad properties
        notepadTextarea.value = notepadData.contents;
        if (notepadData.stowed) {
            cssReady.then(stow);
        } else {
            unstow();
            notepad.style.height = notepadData.unstowedHeight + 'px';
        }
    }
    init();

    document.body.appendChild(notepad);

    // Save callbacks
    window.addEventListener('beforeunload', function() {
        notepadData.contents = notepadTextarea.value;
        memorize('notepadData', notepadData);
    });

    $(document).on(':enginerestart', function() {
        console.log('Engine restart');
        forget('notepadData');
        notepadTextarea.value = '';
        notepadData.unstowedHeight = defaultHeight;
        notepadData.stowed = true;
    });

    const onSaveCache = Config.saves.onSave;
    Config.saves.onSave = function(save) {
        if (!save.metadata) {
            save.metadata = {};
        }
        notepadData.contents = notepadTextarea.value;
        save.metadata.notepadData = notepadData;
        console.log(save);
        if (typeof onSaveCache === 'function') {
            return onSaveCache(save);
        }
    }

    const onLoadCache = Config.saves.onLoad;
    Config.saves.onLoad = function(save) {
        console.log(save);
        if (save.metadata.notepadData) {
            notepadData = save.metadata.notepadData
            init();
        }
        if (typeof onLoadCache === 'function') {
            return onLoadCache(save);
        }
    }

    notepad.getNotes = function() {
        return notepadTextarea.value;
    }

    notepad.stow = stow;
    notepad.unstow = unstow;

    return notepad;
})();

window.notepad = notepad;
const notepad = (function() {
    const defaultHeight = window.innerHeight * 0.3;
    const notepadData = recall("notepadData") || {contents: "", stowed: true, unstowedHeight: defaultHeight};

    const notepad = document.createElement("div");
    notepad.id = "notepad";
    notepad.classList.add("unstowed");

    const notepadToggle = document.createElement("div");
    notepadToggle.id = "notepad_toggle";

    const notepadArrow = document.createElement("div");
    notepadArrow.id = "notepad_arrow";

    const notepadLabel = document.createElement("span");
    notepadLabel.id = "notepad_label";
    notepadLabel.innerText = "Notes";

    const notepadTextarea = document.createElement("textarea");
    notepadTextarea.id = "notepad_textarea";
    notepadTextarea.value = notepadData.contents;

    notepad.appendChild(notepadArrow);
    notepad.appendChild(notepadToggle);
    notepadToggle.appendChild(notepadLabel);
    notepad.appendChild(notepadTextarea);

    let offsetY = 0;

    function stow() {
        notepad.style.height = "35px";
        notepadData.stowed = true;
        notepad.classList.remove("unstowed");
        notepad.classList.add("stowed");
    }
    if (notepadData.stowed) {
        stow();
    } else {
        notepad.style.height = notepadData.unstowedHeight + "px";
    }

    function unstow() {
        notepad.style.height = notepadData.unstowedHeight + "px";
        notepadData.stowed = false;
        notepad.classList.remove("stowed");
        notepad.classList.add("unstowed");
    }

    function resize(e) {
        if (!notepad.classList.contains("notransition")) {
            notepad.classList.add("notransition");
        }
        if (notepadData.stowed) {
            unstow();
        }
        let newHeight = Math.min(Math.max(notepad.getBoundingClientRect().bottom - e.pageY + offsetY, 35), window.innerHeight);
        if (newHeight < 45) {
            notepadData.unstowedHeight = defaultHeight;
            stow();
        } else {
            notepad.style.height = newHeight + "px";
            notepadData.unstowedHeight = Math.max(newHeight, defaultHeight);
        }
    }

    function mouseup(e) {
        if (notepad.classList.contains("notransition")) {
            notepad.classList.remove("notransition");
        } else {
            if (notepadData.stowed) {
                unstow();
            } else {
                stow();
            }
        }
        window.removeEventListener("mousemove", resize);
        window.removeEventListener("mouseup", mouseup);
    }

    notepadToggle.addEventListener("mousedown", function(e) {
        offsetY = e.offsetY;
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", mouseup);
    }, false);

    document.body.appendChild(notepad);

    window.addEventListener("beforeunload", function() {
        notepadData.contents = notepadTextarea.value;
        memorize("notepadData", notepadData);
    });

    $(document).on(":enginerestart", function() {
        forget("notepadData");
        notepadTextarea.value = "";
        notepadData.unstowedHeight = defaultHeight;
        stow();
    });

    return notepad;
})();
window.notepad = notepad;
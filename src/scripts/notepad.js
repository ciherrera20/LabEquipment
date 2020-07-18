const notepad = (function() {
    const notepad = document.createElement("div");
    notepad.id = "notepad";

    const notepadToggle = document.createElement("button");
    notepadToggle.id = "notepad_toggle";
    notepadToggle.innerText = "Notes";

    const notepadTextarea = document.createElement("textarea");
    notepadTextarea.id = "notepad_textarea";
    notepadTextarea.value = recall("notes") || "";

    notepad.appendChild(notepadToggle);
    notepad.appendChild(notepadTextarea);

    const defaultHeight = window.innerHeight * 0.3;
    let stowed = false;
    let unstowedHeight = defaultHeight;

    function stow() {
        notepad.style.height = "35px";
        stowed = true;
        notepad.classList.add("stowed");
    }

    function unstow() {
        notepad.style.height = unstowedHeight + "px";
        stowed = false;
        notepad.classList.remove("stowed");
    }

    function resize(e) {
        if (!notepad.classList.contains("notransition")) {
            notepad.classList.add("notransition");
        }
        if (stowed) {
            unstow();
        }
        let newHeight = Math.min(Math.max(notepad.getBoundingClientRect().bottom - e.pageY, 35), window.innerHeight);
        if (newHeight < 10) {
            unstowedHeight = defaultHeight;
            stow();
        } else {
            notepad.style.height = newHeight + "px";
            unstowedHeight = Math.max(newHeight, defaultHeight);
        }
    }

    function mouseup(e) {
        if (notepad.classList.contains("notransition")) {
            notepad.classList.remove("notransition");
        } else {
            if (stowed) {
                unstow();
            } else {
                stow();
            }
        }
        window.removeEventListener("mousemove", resize);
        window.removeEventListener("mouseup", mouseup);
    }

    notepadToggle.addEventListener("mousedown", function(e) {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", mouseup);
    }, false);

    document.body.appendChild(notepad);

    window.addEventListener("beforeunload", function() {
        memorize("notes", notepadTextarea.value);
    });

    $(document).on(":enginerestart", function() {
        forget("notes");
        notepadTextarea.value = "";
    });

    return notepad;
})();
window.notepad = notepad;
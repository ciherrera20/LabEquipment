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
    let resizing = false;

    // Stow notes
    function stow() {
        notepad.style.height = "35px";
        notepadData.stowed = true;
        notepad.classList.remove("unstowed");
        notepad.classList.add("stowed");
    }
    // Handle default stow and default height
    if (notepadData.stowed) {
        stow();
    } else {
        notepad.style.height = notepadData.unstowedHeight + "px";
    }

    // Unstow notes
    function unstow() {
        notepad.style.height = notepadData.unstowedHeight + "px";
        notepadData.stowed = false;
        notepad.classList.remove("stowed");
        notepad.classList.add("unstowed");
    }

    // Handle mousemove and touchmove events to resize notes
    function resize(e) {
        console.log(e.type);
        if (!notepad.classList.contains("notransition")) {
            notepad.classList.add("notransition");
        }
        if (notepadData.stowed) {
            unstow();
        }
        let pageY = e.type === "mousemove" ? e.pageY : e.touches[0].pageY;
        let newHeight = Math.min(Math.max(notepad.getBoundingClientRect().bottom - pageY + offsetY, 35), window.innerHeight);
        if (newHeight < 45) {
            notepadData.unstowedHeight = defaultHeight;
            stow();
        } else {
            notepad.style.height = newHeight + "px";
            notepadData.unstowedHeight = Math.max(newHeight, defaultHeight);
        }
        e.preventDefault();
    }

    // Handle mouseup and touchend events to remove mousemove, touchmove, mouseup, and touchend event listeners
    function mouseup(e) {
        console.log(e.type);
        if (notepad.classList.contains("notransition")) {
            notepad.classList.remove("notransition");
        } else {
            if (notepadData.stowed) {
                unstow();
            } else {
                stow();
            }
        }
        if (e.type === "mouseup") {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", mouseup);
        } else {
            window.removeEventListener("touchmove", resize);
            window.removeEventListener("touchend", mouseup);
        }
        e.preventDefault();
    }

    // Handle mousedown and touchstart events to add mousemove, touchmove, mouseup, and touchend event listeners
    function mousedown(e) {
        console.log(e.type);
        if (e.type === "mousedown") {
            offsetY = e.offsetY;
            window.addEventListener("mousemove", resize);
            window.addEventListener("mouseup", mouseup);
        } else {
            offsetY = 0;
            window.addEventListener("touchmove", resize);
            window.addEventListener("touchend", mouseup);
        }
        e.preventDefault();
    }

    notepadToggle.addEventListener("mousedown", mousedown);
    notepadToggle.addEventListener("touchstart", mousedown);

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

    notepad.getNotes = function() {
        return notepadTextarea.value;
    }

    notepad.stow = stow;
    notepad.unstow = unstow;

    return notepad;
})();
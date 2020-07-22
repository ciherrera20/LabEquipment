const labreport = (function() {
    const promise = importScripts('https://unpkg.com/jspdf@latest/dist/jspdf.min.js');

    const labreport = Object.create(null);
    let labreportData = recall('labreportData') || {accumulated: '', history: []};
    let momentMap;
    let currentMoment;
    let restartDelta = true;
    let deltaCache;

    const createLabreportMoment = function() {
        const moment = Object.create(null);
        moment.delta = '';
        return moment;
    }

    const initMomentMap = function() {
        //console.log('Init moment map');
        momentMap = new WeakMap();
        State.history.forEach(function(moment, i) {
            let existed = true;
            if (!labreportData.history[i]) {
                existed = false;
                labreportData.history.push(createLabreportMoment());
            }
            momentMap.set(moment, labreportData.history[i]);
            if (i === 0 && !existed) {
                const title = document.getElementById('story-title').innerHTML + ' Report';
                append(`<h1>${title}</h1>`);
            }
        });
        currentMoment = momentMap.get(State.current);
    }

    const manageHistory = function() {
        //console.log('Managing history');
        const maxStates = Config.history.maxStates;

        // Update current moment delta
        //console.log(currentMoment, restartDelta, momentMap, State.current);
        if (currentMoment && !restartDelta) {
            currentMoment.delta = deltaCache;
        }

        // A new moment has been created
        if (State.size > labreportData.history.length) {
            //console.log('New moment created');
            const moment = createLabreportMoment();
            labreportData.history.push(moment);
            momentMap.set(State.current, moment);
        }

        // An old moment has been overwritten
        if (!momentMap.has(State.current)) {
            //console.log('Old moment overwritten');
            const moment = createLabreportMoment();
            labreportData.history[State.history.indexOf(State.current)] = moment;
            momentMap.set(State.current, moment);
        }

        // Accumulate deltas of deleted moments
        while (labreportData.history.length > maxStates) {
            //console.log('Old moment accumulated');
            const moment = labreportData.history.shift();
            labreportData.accumulated += moment.delta;
        }

        // Update local variables
        currentMoment = momentMap.get(State.current);
        deltaCache = '';
        restartDelta = true;
    }

    $(document).one(':storyready', function(e) {
        initMomentMap();
        $(document).on(':passagestart', function(e) {
            manageHistory();
        });
    });

    const append = function(delta) {
        if (!momentMap) {
            $(document).one(':storyready', function() {
                //console.log('Postponing append');
                append(delta);
            });
            return;
        }

        //console.log('Appending:', delta);
        //const moment = momentMap.get(State.current);
        if (restartDelta) {
            //moment.delta = delta;
            deltaCache = delta;
            restartDelta = false;
        } else {
            //moment.delta += delta;
            deltaCache += delta;
        }
    }

    const toPDF = function() {
        return promise.then(function() {
            if (!momentMap) {
                //console.log('Postponing pdf generation');
                return new Promise(function(resolve, reject) {
                    $(document).one(':storyready', function() {
                        toPDF().then(resolve);
                    });
                });
            }

            //console.log('Generating pdf');
            const pdf = new jsPDF('p', 'pt', 'letter');
            const currentMoment = momentMap.get(State.current);
            const margins = {
                top: 40,
                bottom: 60,
                left: 40,
                width: 522
            };
            let source = labreportData.accumulated;
            labreportData.history.find(function(moment) {
                source += moment.delta;
                return moment === currentMoment;
            });
            if (notepad) {
                source += `<h2>Notes:</h2><span>${notepad.getNotes().replace(/\n/g, '<br>')}</span>`;
            }
            pdf.fromHTML(source , margins.left, margins.top, {width: margins.width});
            return pdf;
        });
    }

    window.addEventListener('beforeunload', function() {
        memorize('labreportData', labreportData);
    });

    $(document).on(':enginerestart', function() {
        forget('labreportData');
        labreportData = undefined;
    });

    const onSaveCache = Config.saves.onSave;
    Config.saves.onSave = function(save) {
        if (!save.metadata) {
            save.metadata = {};
        }
        save.metadata.labreportData = labreportData;
        if (typeof onSaveCache === 'function') {
            return onSaveCache(save);
        }
    }

    const onLoadCache = Config.saves.onLoad;
    Config.saves.onLoad = function(save) {
        if (save.metadata.labreportData) {
            labreportData = save.metadata.labreportData;
            initMomentMap();
        }
        if (typeof onLoadCache === 'function') {
            return onLoadCache(save);
        }
    }

    Macro.add('report', {
        skipArgs: false,
        tags: ['setTitle', 'appendRaw', 'appendHeader', 'appendParagraph', 'appendText', 'appendNewline', 'displayPDF'],
        handler() {
            const that = this;
            this.payload.forEach(function(chunk) {
                if (chunk.name === 'setTitle') {
                    if (typeof chunk.args[0] !== 'string') {
                        that.error('setTitle argument must be a string');
                    }
                    labreportData.history[0].delta = `<h1>${this.args[0]}</h1>`;
                } else if (chunk.name === 'appendRaw') {
                    if (typeof chunk.args[0] !== 'string') {
                        that.error('appendRaw argument must be a string');
                    }
                    append(chunk.args[0]);
                } else if (chunk.name === 'appendHeader') {
                    if (typeof chunk.args[0] !== 'string') {
                        that.error('appendHeader argument must be a string');
                    }
                    append(`<h3>${chunk.args[0]}</h3>`);
                } else if (chunk.name === 'appendParagraph') {
                    if (typeof chunk.args[0] !== 'string') {
                        that.error('appendParagraph argument must be a string');
                    }
                    append(`<p>${chunk.args[0]}</p>`);
                } else if (chunk.name === 'appendText') {
                    if (typeof chunk.args[0] !== 'string') {
                        that.error('appendText argument must be a string');
                    }
                    append(`<span>${chunk.args[0]}</span>`);
                }
                else if (chunk.name === 'appendNewline') {
                    let numNewlines = 1;
                    if (chunk.args[0]) {
                        if (typeof chunk.args[0] !== 'number') {
                            that.error('appendNewline argument must be a number');
                        }
                        numNewlines = chunk.args[0];
                    }
                    for (var i = 0; i < numNewlines; i++) {
                        append(`<br>`);
                    }
                } else if (chunk.name === 'displayPDF') {
                    const pdfContainer = document.createElement('div');
                    pdfContainer.classList.add('pdfcontainer');

                    const pdfViewer = document.createElement('iframe');
                    labreport.toPDF().then(function(pdf) {
                        pdfViewer.src = URL.createObjectURL(pdf.output('blob', 'labreport'));
                    });
                    pdfViewer.classList.add('pdfviewer');

                    pdfContainer.appendChild(pdfViewer);
                    jQuery(that.output).append(pdfContainer);
                }
                jQuery(that.output).wiki(chunk.contents);
            });
        }
    });

    labreport.append = append;
    labreport.toPDF = toPDF;
    //labreport.data = labreportData;
    //labreport.map = momentMap;

    return labreport;
})();
//window.labreport = labreport;
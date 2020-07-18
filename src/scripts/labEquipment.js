// Deep copies keys from the object from to the object to
const cloneKeys = function(from, to) {
	Object.keys(from).forEach(function(key) {
		to[key] = clone(from[key]);
	});
	return to;
}

if (!Object.freezeProperty) {
    Object.defineProperty(Object, "freezeProperty", {
        writable: false,
        configurable: false,
        enumerable: true,
        value(obj, key) {
            Object.defineProperty(obj, key, {
                writable: false,
                configurable: false
            });
        }
    });
}

if (!Object.freezeProperties) {
    Object.defineProperty(Object, "freezeProperties", {
        writable: false,
        configurable: false,
        enumerable: true,
        value(obj, keys) {
            keys.forEach(function(key) {
                Object.defineProperty(obj, key, {
                    writable: false,
                    configurable: false
                });
            });
        }
    });
}

if (!Function.prototype.inheritFrom) {
    Object.defineProperty(Function.prototype, "inheritFrom", {
        writable: false,
        configurable: false,
        enumerable: true,
        value(parent) {
            this.prototype = Object.create(parent.prototype);
            this.prototype.constructor = this;
        }
    });
}

// EventDispatcher constructor
const EventDispatcher = (function(){
    // Store object states
    const states = Object.create(null);
    
    /**
     * Populates EventDispatcher from a config object
     *
     * @param config		Config object to assign properties from
     *
     * @return				The EventDispatcher object
     */
    const populate = function(config) {
        if (!states[this.key]) {
            // Create internal object state
            const state = Object.create(null);
            states[this.key] = state;
            
            state.eventNames = config.eventNames;
            state.callbacks = Object.create(null);
            
            this.defineEvents(config.eventNames);
        }
    }
    
    /**
     * Creates an EventDispatcher object
     * Handles dispatching events and calling registered callbacks
     *
     * @param eventNames	Array of event names to define
     */
    const EventDispatcher = function(eventNames) {
        // Creates and returns the EventDispatcher object
        if (!this) {
            const eventDispatcher = Object.create(EventDispatcher.prototype);
            EventDispatcher.call(eventDispatcher, ...arguments);
            return Object.freeze(eventDispatcher);
        }
        
        // Creates a config object to populate the EventDispatcher object with
        const config = Object.create(null);
        config.eventNames = eventNames;
        populate.call(this, config);
    }
    
    // Public methods
    /**
     * Define events given an array of event names
     *
     * @param eventNames	Array of event names to define
     */
    EventDispatcher.prototype.defineEvents = function(eventNames) {
        // Retrieve internal state
        const state = states[this.key];
        const callbacks = state.callbacks;
        
        // Add event name arrays to callback object
        eventNames.forEach(function(eventName) {
            if (!callbacks[eventName]) {
                callbacks[eventName] = new Set();
            }
        });	
    }
    
    /**
     * Dispatch an event to the registered callbacks
     *
     * @param LEvent		The lab event to dispatch
     */
    EventDispatcher.prototype.dispatchEvent = function(LEvent) {
        // Retrieve internal state
        const state = states[this.key];
        const callbacks = state.callbacks;
        
        // Retrieve event name
        const eventName = LEvent.type;
        
        // Input validation
        if (!callbacks[eventName]) throw new Error("The event \"" + eventName + "\" has not been defined");
        
        // Execute all callbacks for the given event with the given event data
        callbacks[eventName].forEach(function(callback) {
            callback(LEvent);
        });
    }
    
    /**
     * Add an event listener callback for a given event
     *
     * @param eventName		The name of the event to listen for
     * @param callback		The callback
     */
    EventDispatcher.prototype.addEventListener = function(eventName, callback) {
        // Retrieve internal state
        const state = states[this.key];
        const callbacks = state.callbacks;
        
        // Input validation
        if (!callback) throw new Error("A callback function must be provided");
        
        // Add callback
        if (callbacks[eventName]) {
            callbacks[eventName].add(callback);
        }
    }
    
    /**
     * Remove a given event listener callback for a given event
     *
     * @param eventName		The name of the event
     * @param callback		The callback to remove
     */
    EventDispatcher.prototype.removeEventListener = function(eventName, callback) {
        // Retrieve internal state
        const state = states[this.key];
        const callbacks = state.callbacks;
        
        // Input validation
        if (!callback) throw new Error("A callback function must be provided");
        
        // Remove callback
        callbacks[eventName].delete(callback);
    }
    
    /**
     * Return all callbacks registered for the given event name
     *
     * @param eventName		The event name
     *
     * @return				An array of callbacks
     */
    EventDispatcher.prototype.getEventListeners = function(eventName) {
        // Retrieve internal state
        return states[this.key].callbacks[eventName];
    }
    
    /**
     * Return a copy of the array of all event names
     *
     * @return				The copy of the array of all event names
     */
    EventDispatcher.prototype.getEventNames = function() {
        // Retrieve internal state
        return states[this.key].eventNames;
    }

    EventDispatcher.prototype.hasEvent = function(eventName) {
        return Boolean(states[this.key].callbacks[eventName]);
    }

    const contentMap = Object.create(null);
    const hasContent = function(obj, content) {
        const contents = contentMap[obj.key];
        if (!contents) {
            return false;
        }
        return contents.has(content);
    }
    const addContent = function(obj, content) {
        let contents = contentMap[obj.key];
        if (!contents) {
            contents = contentMap[obj.key] = new Set();
        }
        contents.add(content);
    }

    Macro.add("on", {
        tags: null,
        handler() {
            const that = this;

            // Find first macro context whose first argument is an EventDispatcher
            const eventContext = this.contextSelect(function(context) {
                return context.args[0] && context.args[0].addEventListener === EventDispatcher.prototype.addEventListener;
            });

            // Make sure eventContext is not null
            if (eventContext === null) {
                that.error("'on' macro must have a parent context whose first argument is an instance of EventDispatcher");
            }
            const parentObject = eventContext.args[0];

            // Determine whether the callback should be run as javascript
            let isJS = false;
            if (this.args[this.args.length - 1] === "JS") {
                isJS = true;
                this.args.pop();
            }

            // Check if the instance of EventDispatcher has the given event names
            const eventNames = this.args.map(function(arg) {
                if (typeof arg !== "string") {
                    that.error("Argument must be a string");
                } else if (!parentObject.hasEvent(arg)) {
                    that.error("Parent object does not have an event names " + eventName);
                }
                return arg;
            });

            // Create and add callback function
            const content = this.payload[0].contents.trim();
            if (content !== "" && !hasContent(parentObject, content)) {
                addContent(parentObject, content);
                let callback;
                if (isJS) {
                    callback = Function("event", content);
                } else {
                    this.addShadow("$event");
                    callback = this.createShadowWrapper(function(event) {
                        const eventCache = State.variables.event;
                        State.variables.event = event;
                        Wikifier.wikifyEval(content);
                        if (eventCache !== undefined) {
                            State.variables.event = eventCache;
                        } else {
                            delete State.variables.event;
                        }
                    });
                }
                eventNames.forEach(function(eventName) {
                    parentObject.addEventListener(eventName, callback);
                });
            }
        }
    });

    return EventDispatcher;
})();

const LEvent = (function() {
    /**
     * Populates a LEvent object from a config object
     *
     * @param config		The config object
     *
     * @return				The LEvent object
     */
    const populate = function(config) {
        this.type = config.eventName;
        Object.assign(this, config.eventProperties);
    }
    
    /**
     * Creates a LEvent object
     * Stands for Lab Event
     * Holds information about the event, including a type property whose value is the event's name
     *
     * @param eventName			The name of the event
     * @param eventProperties	Additional properties to by added to the LEvent object
     */
    const LEvent = function(eventName, eventProperties) {
        // Creates and returns the LEvent object
        if (!this) {
            const lEvent = Object.create(LEvent.prototype);
            LEvent.call(lEvent, ...arguments);
            return Object.freeze(lEvent);
        }
        
        // Creates a config object to populate the LEvent object with
        const config = Object.create(null);
        config.eventName = eventName;
        config.eventProperties = eventProperties;
        populate.call(this, config);
    }
    
    return LEvent;
})();

const Cloneable = (function() {
    const populate = function(config) {
    }

    const Cloneable = function() {
        if (!this) {
            const cloneable = Object.create(Cloneable.prototype);
            Cloneable.call(cloneable, ...arguments);
            return cloneable;
        }

        const config = Object.create(null);
        populate.call(this, config);
    }

    Cloneable.prototype.clone = function() {
        //console.log("Object cloned");
        return this.constructor.fromObj(this.toObj());
    }

    Cloneable.prototype.toObj = function() {
        return cloneKeys(this, {});
    }

    Cloneable.fromObj = function(obj) {
        if (this === Cloneable) {
            const cloneable = Object.create(Cloneable.prototype);
            Object.assign(cloneable, obj);
            Cloneable.fromObj.call(cloneable, obj);
            return cloneable;
        }

        const config = Object.create(null);
        populate.call(this, config);
    }

    /**
     * Factory function that returns a toJSON function given the name of a constructor
     * 
     * @param constructorName   The name of the constructor
     */
    const toJSONFactory = function(constructorName) {
        if (!setup[constructorName]) {
			throw new Error("Constructor must be a property on the setup object");
		}

		return function() {
			return JSON.reviveWrapper('setup.' + constructorName + '.fromObj($ReviveData$)', this.toObj());
		}
    }

    /**
     * Sets up a constructor to produce cloneable objects by adding toJSON and fromObj functions to its prototype
     * 
     * @param constructor           The constructor
     * @param constructorName       The name of the constructor, as a string, to be used
     */
    Cloneable.setupConstructor = function(constructor, constructorName) {
        setup[constructorName] = constructor;
        constructor.prototype.toJSON = toJSONFactory(constructorName);
    }
    Cloneable.setupConstructor(Cloneable, "Cloneable");

    return Cloneable;
})();

const SCVariable = (function() {
    const populate = function(config) {
        this.key = config.key;
        Object.freezeProperty(this, "key");
    }

    const SCVariable = function(key) {
        if (!this) {
            const scVariable = Object.create(SCVariable.prototype);
            SCVariable.call(scVariable, ...arguments);
            return scVariable;
        }
        Cloneable.call(this);

        const config = Object.create(null);
        config.key = key;
        populate.call(this, config);
        State.variables[this.key] = this;
    }
    SCVariable.inheritFrom(Cloneable);
    Cloneable.setupConstructor(SCVariable, "SCVariable");

    SCVariable.prototype.getKey = function() {
        return this.key;
    }

    SCVariable.prototype.getVar = function() {
        return State.variables[this.key];
    }

	SCVariable.getVar = function(key) {
		return State.variables[key];
    }
    
    SCVariable.fromObj = function(obj) {
        if (this === SCVariable) {
            const scVariable = Object.create(SCVariable.prototype);
            Object.assign(scVariable, obj);
            SCVariable.fromObj.call(scVariable, obj);
            return scVariable;
        }
        Cloneable.fromObj.call(this, obj);

        const config = Object.create(null);
        config.key = obj.key;
        populate.call(this, config);
    }

    return SCVariable;
})();

const LabEquipment = (function() {
    const populate = function(config) {
        this.displayName = config.displayName;
        this.containedIn = config.containedIn;
    }

    const LabEquipment = function(key) {
        if (!this) {
            const labEquipment = Object.create(LabEquipment.prototype);
            LabEquipment.call(labEquipment, ...arguments);
            return labEquipment;
        }
        SCVariable.call(this, key);
        EventDispatcher.call(this, []);

        const config = Object.create(null);
        config.displayName = key;
        populate.call(this, config);
    }
    LabEquipment.inheritFrom(SCVariable);
    Object.assign(LabEquipment.prototype, EventDispatcher.prototype);
    Cloneable.setupConstructor(LabEquipment, "LabEquipment");

    LabEquipment.fromObj = function(obj) {
        if (this === LabEquipment) {
            const labEquipment = Object.create(LabEquipment.prototype);
            Object.assign(labEquipment, obj);
            LabEquipment.fromObj.call(labEquipment, obj);
            return labEquipment;
        }
        SCVariable.fromObj.call(this, obj);
        EventDispatcher.call(this, []);

        const config = Object.create(null);
        config.displayName = obj.displayName;
        config.containedIn = obj.containedIn;
        populate.call(this, config);
    }

    return LabEquipment;
})();

const EquipmentContainer = (function() {
    const populate = function(config) {
        this.contents = config.contents;
        this.singleItem = config.singleItem;
        this.defineEvents(["itemadded", "itemremoved"]);
    }

    const EquipmentContainer = function(key) {
        if (!this) {
            const equipmentContainer = Object.create(EquipmentContainer.prototype);
            EquipmentContainer.call(equipmentContainer, ...arguments);
            return equipmentContainer;
        }
        LabEquipment.call(this, key);

        const config = Object.create(null);
        config.contents = [];
        config.singleItem = false;
        populate.call(this, config);
    }
    EquipmentContainer.inheritFrom(LabEquipment);
    Cloneable.setupConstructor(EquipmentContainer, "EquipmentContainer");

    EquipmentContainer.prototype.add = function(item) {
        if (item.containedIn) {
            SCVariable.getVar(item.containedIn).remove(item);
        }
        item.containedIn = this.key;
        if (this.singleItem && this.contents.length > 0) {
            this.removeAll();
        }
        this.contents.push(item.key);

        const e = Object.create(null);
        e.parent = this;
        e.itemAdded = item;
        this.dispatchEvent(LEvent("itemadded", e));
    }

    EquipmentContainer.prototype.indexOf = function(item) {
        return this.contents.indexOf(item.key);
    }

    EquipmentContainer.prototype.remove = function(item) {
        var index = this.indexOf(item);
		if (index != -1) {
			return this.removeIndex(index);
		}
		return null;
    }

    EquipmentContainer.prototype.removeAll = function() {
        let that = this;
        this.contents.forEach(function(item, i) {
            that.removeIndex(i);
        });
    }

    EquipmentContainer.prototype.removeIndex = function(index) {
        if (index < 0 || index >= this.contents.length) {
			return null;	
        }
        const itemRemoved = SCVariable.getVar(this.contents.splice(index, 1)[0]);
        itemRemoved.containedIn = undefined;

        const e = Object.create(null);
        e.parent = this;
        e.itemRemoved = itemRemoved;
        this.dispatchEvent(LEvent("itemremoved", e));

		return itemRemoved;
    }

    EquipmentContainer.prototype.get = function(index) {
        return SCVariable.getVar(this.contents[index]);
    }

    EquipmentContainer.fromObj = function(obj) {
        if (this === EquipmentContainer) {
            const equipmentContainer = Object.create(EquipmentContainer.prototype);
            Object.assign(equipmentContainer, obj);
            EquipmentContainer.fromObj.call(equipmentContainer, obj);
            return equipmentContainer;
        }
        LabEquipment.fromObj.call(this, obj);

        const config = Object.create(null);
        config.contents = obj.contents;
        config.singleItem = obj.singleItem;
        populate.call(this, config);
    }

    return EquipmentContainer;
})();

const Balance = (function() {
    const populate = function(config) {
        this.offset = config.offset;
        this.decimalPlaces = config.decimalPlaces;
        this.defineEvents(["zero", "measurement"]);
    }

    const Balance = function(key) {
        if (!this) {
            const balance = Object.create(Balance.prototype);
            Balance.call(balance, ...arguments);
            return balance;
        }
        EquipmentContainer.call(this, key);

        const config = Object.create(null);
        config.offset = Math.floor((Math.random() * 11) - 5);
        config.decimalPlaces = Infinity;
        populate.call(this, config);
    }
    Balance.inheritFrom(EquipmentContainer);
    Cloneable.setupConstructor(Balance, "Balance");

    Balance.prototype.measureMass = function() {
        let measuredMass = this.offset + this.contents.reduce(function(acc, item) {
			return acc + SCVariable.getVar(item).getMass();
        }, 0);
        
        const e = Object.create(null);
        e.parent = this;
        e.measuredMass = measuredMass;
        this.dispatchEvent(LEvent("measurement", e));

        if (this.decimalPlaces !== Infinity) {
            measuredMass = Math.round(measuredMass * Math.pow(10, this.decimalPlaces)) / Math.pow(10, this.decimalPlaces);
        }

        return measuredMass;
    }

    Balance.prototype.zero = function() {
        this.offset = -(this.measureMass() - this.offset);
        
        const e = Object.create(null);
        e.parent = this;
        e.offset = this.offset;
        this.dispatchEvent(LEvent("zero", e));
    }

    Balance.prototype.updateContentsDisplays = function() {
        const that = this;
        const contentDisplays = document.getElementById("passages").querySelectorAll(`.${this.key}_contents_display`);
        contentDisplays.forEach(function(contentDisplay) {
            const emptyText = contentDisplay.emptyText || `There is nothing on the ${that.displayName}`;
            const notEmptyText = contentDisplay.notEmptyText || `The ${that.displayName} has on it:`;
            jQuery(contentDisplay).empty();
            jQuery(contentDisplay).wiki(`
                <<if $${that.key}.contents.length === 0>>
                    ${emptyText}
                <<else>>
                    ${notEmptyText}<br>
                <</if>>
                <<for _i = 0; _i < $${that.key}.contents.length; _i++>>
                    <<capture _i>>
                        <p class="in"><<= $${that.key}.get(_i).displayName>> - <<link "remove">><<run $${that.key}.removeIndex(_i)>><</link>></p>
                    <</capture>>
                <</for>>
            `.replace(/\r?\n|\r/g, ""));
        });
    }
    const updateContentsDisplaysCallback = function(e) {
        e.parent.updateContentsDisplays();
    }

    Balance.prototype.updateMeasurementDisplays = function() {
        const that = this;
        const measurementDisplays = document.getElementById("passages").querySelectorAll(`.${this.key}_measurement_display`);
        measurementDisplays.forEach(function(measurementDisplay) {
            jQuery(measurementDisplay).html(that.measureMass());
        });
    }
    const updateMeasurementDisplaysCallback = function(e) {
        e.parent.updateMeasurementDisplays();
    }

    Balance.prototype.updateAddOptionDisplays = function() {
        const that = this;
        const addOptionDisplays = document.getElementById("passages").querySelectorAll(`.${this.key}_add_option_display`);
        console.log("Updating add option displays");
        addOptionDisplays.forEach(function(addOptionDisplay) {
            const objectToAdd = addOptionDisplay.objectToAdd;
            const addPassage = addOptionDisplay.addPassage || "";
            const removePassage = addOptionDisplay.removePassage || "";
            const addText = addOptionDisplay.addText || `Place ${objectToAdd.displayName} on ${that.displayName}`;
            const removeText = addOptionDisplay.removeText || `Remove ${objectToAdd.displayName} from ${that.displayName}`;
            jQuery(addOptionDisplay).empty();
            if (that.indexOf(addOptionDisplay.objectToAdd) === -1) {
                jQuery(addOptionDisplay).wiki(`
                    <<link "${addText}" ${addPassage}>>
                        <<run $${that.key}.add($${objectToAdd.key})>>
                    <</link>>
                `.replace(/\r?\n|\r/g, ""));
            } else {
                jQuery(addOptionDisplay).wiki(`
                    <<link "${removeText}" ${removePassage}>>
                        <<run $${that.key}.remove($${objectToAdd.key})>>
                    <</link>>
                `.replace(/\r?\n|\r/g, ""));
            }
        });
    }
    const updateAddOptionDisplaysCallback = function(e) {
        e.parent.updateAddOptionDisplays();
    }

    Balance.fromObj = function(obj) {
        if (this === Balance) {
            const balance = Object.create(Balance.prototype);
            Object.assign(balance, obj);
            Balance.fromObj.call(balance, obj);
            return balance;
        }
        EquipmentContainer.fromObj.call(this, obj);

        const config = Object.create(null);
        config.offset = obj.offset;
        config.decimalPlaces = obj.decimalPlaces;
        populate.call(this, config);
    }
    
    Macro.add("balance", {
        tags: ["offset", "singleItem", "decimalPlaces", "displayName", "displayContents", "displayMeasurement", "displayAddOption"],
        handler() {
            const that = this;
            //console.log(this);
            if (this.args.length < 1) {
                throw new Error("Missing Balance instance");
            }
            let parentObject = this.args[0];
            if (!parentObject) {
                parentObject = Balance(this.args.raw.slice(1));
                this.args[0] = parentObject;
            } else {
                if (!(parentObject instanceof Balance)) {
                    throw new Error("Argument must be an instance of Balance");
                }
            }
            this.payload.forEach(function(chunk) {
                if (chunk.name === "offset") {
                    parentObject.offset = Number(chunk.args[0]);
                } else if (chunk.name === "singleItem") {
                    parentObject.singleItem = Boolean(chunk.args[0]);
                } else if (chunk.name === "decimalPlaces") {
                    parentObject.decimalPlaces = Number(chunk.args[0]);
                } else if (chunk.name === "displayName") {
                    parentObject.displayName = String(chunk.args[0]);
                } else if (chunk.name === "displayContents") {
                    const contentsDisplay = document.createElement("div");
                    contentsDisplay.className = parentObject.key + "_contents_display";
                    contentsDisplay.emptyText = chunk.args[0] ? chunk.args[0] : "";
                    contentsDisplay.notEmptyText = chunk.args[1] ? chunk.args[1] : "";
                    jQuery(that.output).append(contentsDisplay);
                    $(document).on(":passagedisplay", function(e) {
                        parentObject.updateContentsDisplays();
                    });
                    parentObject.addEventListener("itemadded", updateContentsDisplaysCallback);
                    parentObject.addEventListener("itemremoved", updateContentsDisplaysCallback);
                } else if (chunk.name === "displayMeasurement") {
                    const measurementDisplay = document.createElement("span");
                    measurementDisplay.className = parentObject.key + "_measurement_display";
                    jQuery(that.output).append(measurementDisplay);
                    $(document).on(":passagedisplay", function(e) {
                        parentObject.updateMeasurementDisplays();
                    });
                    parentObject.addEventListener("itemadded", updateMeasurementDisplaysCallback);
                    parentObject.addEventListener("itemremoved", updateMeasurementDisplaysCallback);
                    parentObject.addEventListener("zero", updateMeasurementDisplaysCallback);
                } else if (chunk.name === "displayAddOption") {
                    const addOptionDisplay = document.createElement("span");
                    addOptionDisplay.className = parentObject.key + "_add_option_display";
                    addOptionDisplay.objectToAdd = chunk.args[0];
                    addOptionDisplay.addPassage = chunk.args[1] ? chunk.args[1] : "";
                    addOptionDisplay.removePassage = chunk.args[2] ? chunk.args[2] : "";
                    addOptionDisplay.addText = chunk.args[3] ? chunk.args[3] : "";
                    addOptionDisplay.removeText = chunk.args[4] ? chunk.args[4] : "";
                    jQuery(that.output).append(addOptionDisplay);
                    $(document).on(":passagedisplay", function(e) {
                        parentObject.updateAddOptionDisplays();
                    });
                    parentObject.addEventListener("itemadded", updateAddOptionDisplaysCallback);
                    parentObject.addEventListener("itemremoved", updateAddOptionDisplaysCallback);
                }
                jQuery(that.output).wiki(chunk.contents);
            });
        }
    });

    return Balance;
})();

const MaterialContainer = (function() {
    const populate = function(config) {
        this.contents = config.contents;
        this.restMass = config.restMass;
        this.capacity = config.capacity || Infinity;
        this.volume = config.volume || 0;
        this.contentMass = config.contentMass || 0;
        this.defineEvents(["materialadded", "materialremoved", "materialscombined", "emptied", "overflow"]);
    }

    const MaterialContainer = function(key, restMass) {
        if (!this) {
            const materialContainer = Object.create(MaterialContainer.prototype);
            MaterialContainer.call(materialContainer, ...arguments);
            return materialContainer;
        }
        LabEquipment.call(this, key);

        const config = Object.create(null);
        config.contents = [];
        config.restMass = restMass;
        populate.call(this, config);
    }
    MaterialContainer.inheritFrom(LabEquipment);
    Cloneable.setupConstructor(MaterialContainer, "MaterialContainer");

    const updateMeasurements = function() {
        let contentMass = 0;
        this.volume = this.contents.reduce(function(volume, material) {
            contentMass += material.mass;
            return volume + material.volume;
        }, 0);
        this.contentMass = contentMass;
    }

    /**
     * Add a material to this material container
     * Triggers a materialadded event
     * If the material being added causes the container to overflow, split it into material added 
     * and material discarded and trigger an overflow event
     * 
     * @param material      The material to add
     */
    MaterialContainer.prototype.add = function(material) {
        const surplus = (this.volume + material.volume) - this.capacity;
        if (surplus > 0) {
            const e = Object.create(null);
            e.parent = this;
            e.materialAdded = material;
            this.dispatchEvent(LEvent("overflow", e));
            return;
        }

        this.contents.push(material);

        {
            const e = Object.create(null);
            e.parent = this;
            e.materialAdded = material;
            this.dispatchEvent(LEvent("materialadded", e));
        }

        const e = Object.create(null);
        e.parent = this;
        e.previousVolume = this.volume;
        e.previousContents = this.contents;

        this.contents = MaterialManager.evaluateContents(clone(this.contents));
        updateMeasurements.call(this);

        this.dispatchEvent(LEvent("materialscombined", e));
    }

    MaterialContainer.prototype.indexOf = function(material) {
        return this.contents.indexOf(material);
    }

    const indexOfName = function(name) {
        return this.contents.findIndex(function(material) {
            return material.name === name;
        });
    }

    MaterialContainer.prototype.remove = function(name) {
        var index = indexOfName.call(this, name);
		if (index != -1) {
			return this.removeIndex(index);
		}
		return null;
    }

    MaterialContainer.prototype.has = function(name) {
        return indexOfName.call(this, name) !== -1;
    }

    MaterialContainer.prototype.get = function(name) {
        const index = indexOfName.call(this, name);
        if (index !== -1) {
            return this.contents[index];
        }
    }

    MaterialContainer.prototype.emptyInto = function(newContainer) {
        while (this.contents.length !== 0) {
            if (newContainer) {
                newContainer.add(this.contents.pop());
            } else {
                this.contents.pop();
            }
        }

        updateMeasurements.call(this);

        const e = Object.create(null);
        e.parent = this;
        e.newContainer = newContainer;
        this.dispatchEvent(LEvent("emptied", e));
    }

    MaterialContainer.prototype.removeIndex = function(index) {
        if (index < 0 || index >= this.contents.length) {
			return null;	
        }
        const materialRemoved = this.contents.splice(index, 1)[0];
        
        this.volume -= materialRemoved.volume;
        this.contentMass -= materialRemoved.mass;

        const e = Object.create(null);
        e.parent = this;
        e.materialRemoved = materialRemoved;
        this.dispatchEvent(LEvent("materialremoved", e));

		return materialRemoved;
    }

	MaterialContainer.prototype.getMass = function() {
		return this.restMass + this.contentMass;
	}

    MaterialContainer.fromObj = function(obj) {
        if (this === MaterialContainer) {
            const materialContainer = Object.create(MaterialContainer.prototype);
            Object.assign(materialContainer, obj);
            MaterialContainer.fromObj.call(materialContainer, obj);
            return materialContainer;
        }
        LabEquipment.fromObj.call(this, obj);

        const config = Object.create(null);
        config.contents = obj.contents;
        config.restMass = obj.restMass;
        config.capacity = obj.capacity;
        config.volume = obj.volume;
        config.contentMass = obj.contentMass;
        populate.call(this, config);
    }

    Macro.add("container", {
        tags: ["restMass", "capacity", "displayName", "displayAddMaterial", "displayEmptyInto"],
        handler() {
            const that = this;
            //console.log(this);
            if (this.args.length < 1) {
                throw new Error("Missing MaterialContainer instance");
            }
            let parentObject = this.args[0];
            if (!parentObject) {
                parentObject = MaterialContainer(this.args.raw.slice(1));
                this.args[0] = parentObject;
            } else {
                if (!(parentObject instanceof Balance)) {
                    throw new Error("Argument must be an instance of MaterialContainer");
                }
            }
            this.payload.forEach(function(chunk) {
                if (chunk.name === "restMass") {
                    parentObject.restMass = Number(chunk.args[0]);
                } else if (chunk.name === "capacity") {
                    parentObject.capacity = Number(chunk.args[0]);
                } else if (chunk.name === "displayName") {
                    parentObject.displayName = String(chunk.args[0]);
                }
                jQuery(that.output).wiki(chunk.contents);
            });
        }
    });

    return MaterialContainer;
})();

const GraduatedCylinder = (function() {
    const states = Object.create(null);
    
    const populate = function(config) {
        if (!states[this.key]) {
            const state = Object.create(null);
            states[this.key] = state;
        }
    }

    const GraduatedCylinder = function(key) {
        if (!this) {
            const graduatedCylinder = Object.create(GraduatedCylinder.prototype);
        }
    }
    GraduatedCylinder.inheritFrom(MaterialContainer);
})();

const MaterialDefinition = (function() {
    const definitions = new Map();

    const MaterialDefinition = function(name, intensiveProperties) {
        const definition = Object.create(null);
        definition.name = name;
        definition.intensiveProperties = intensiveProperties;
        Object.defineProperties(definition, {
            intProps: {
                get() {
                    return this.intensiveProperties;
                }
            }
        });
        definitions.set(name, definition);
    }

    MaterialDefinition.getDefinition = function(name) {
        const definition = definitions.get(name);
        if (!definition) {
            throw new Error("A material named " + name + " is not defined");
        }
        return definition;
    }

    Macro.add("defineMaterial", {
        handler() {
            if (typeof this.args[0] !== "string") {
                this.error("Missing material name.");
            } else if (this.args[1] && typeof this.args[1] !== "object") {
                this.error("Additional intensive property argument must be an object.");
            }
            const intensiveProperties = this.args[1] || {};
            MaterialDefinition(this.args[0], intensiveProperties);
        }
    });

    return MaterialDefinition;
})();
window.MaterialDefinition = MaterialDefinition;

const Material = (function() {
    const populate = function(config) {
        const definition = MaterialDefinition.getDefinition(config.name);
        this.name = config.name;
        this.extensiveProperties = config.extensiveProperties;
        this.attributes = config.attributes;
        Object.defineProperties(this, {
            intensiveProperties: {
                get() {
                    return definition.intensiveProperties;
                }
            },
            intProps: {
                get() {
                    return definition.intensiveProperties;
                }
            },
            extProps: {
                get() {
                    return this.extensiveProperties;
                }
            },
            mass: {
                // Gets mass if the property exists. If only density and volume exist, return a calculated mass. If none exist, return 0
                get() {
                    if (this.extensiveProperties.mass) {
                        return this.extensiveProperties.mass;
                    } else if (this.extensiveProperties.volume && definition.intensiveProperties.density) {
                        return this.extensiveProperties.volume * definition.intensiveProperties.density;
                    } else {
                        return 0;
                    }
                },
                // Sets mass if the property exists. If only density and volume exist, set a calculated volume. If none exist, set mass
                set(mass) {
                    if (this.extensiveProperties.mass) {
                        this.extensiveProperties.mass = mass;
                    } else if (this.extensiveProperties.volume && definition.intensiveProperties.density) {
                        this.extensiveProperties.volume = mass / definition.intensiveProperties.density;
                    } else {
                        this.extensiveProperties.mass = mass;
                    }
                }
            },
            volume: {
                // Gets volume if the property exists. If only density and mass exist, return a calculated volume. If none exist, return 0
                get() {
                    if (this.extensiveProperties.volume) {
                        return this.extensiveProperties.volume;
                    } else if (this.extensiveProperties.mass && definition.intensiveProperties.density) {
                        return this.extensiveProperties.mass / definition.intensiveProperties.density;
                    } else {
                        return 0;
                    }
                },
                // Sets volume if the property exists. If only density and mass exist, set a calculated mass. If none exist, set volume
                set(volume) {
                    if (this.extensiveProperties.volume) {
                        this.extensiveProperties.volume = volume;
                    } else if (this.extensiveProperties.volume && definition.intensiveProperties.density) {
                        this.extensiveProperties.mass = volume * definition.intensiveProperties.density;
                    } else {
                        this.extensiveProperties.volume = volume;
                    }
                }
            }
        });
    }

    const Material = function(name, extensiveProperties = Object.create(null), attributes = Object.create(null)) {
        if (!this) {
            const material = Object.create(Material.prototype);
            Material.call(material, ...arguments);
            return material;
        }
        Cloneable.call(this);

        const config = Object.create(null);
        config.name = name;
        config.extensiveProperties = extensiveProperties;
        config.attributes = attributes;
        populate.call(this, config);
    }
    Material.inheritFrom(Cloneable);
    Cloneable.setupConstructor(Material, "Material");

    Material.prototype.splitOff = function(percentage) {
        const that = this;
        const newMaterial = Material(this.name, clone(this.extensiveProperties), clone(this.attributes));
        Object.keys(newMaterial.extensiveProperties).forEach(function(key) {
            newMaterial.extensiveProperties[key] *= percentage;
            that.extensiveProperties[key] *= (1 - percentage);
        });
        return newMaterial;
    }

    Material.prototype.combineLike = function(material) {
        const that = this;
        if (material.name === this.name) {
            Object.keys(material.extensiveProperties).forEach(function(key) {
                that.extensiveProperties[key] += material.extensiveProperties[key];
                material.extensiveProperties[key] = 0;
            });
        }
        return this;
    }

    Material.prototype.toObj = function() {
        const obj = {};
        obj.name = this.name;
        obj.extensiveProperties = this.extensiveProperties;
        obj.attributes = this.attributes;
        return obj;
    }

    Material.fromObj = function(obj) {
        if (this === Material) {
            const material = Object.create(Material.prototype);
            Material.fromObj.call(material, obj);
            return material;
        }
        Cloneable.fromObj.call(this, obj);
        
        const config = Object.create(null);
        config.name = obj.name;
        config.extensiveProperties = clone(obj.extensiveProperties);
        config.attributes = clone(obj.attributes);
        populate.call(this, config);
    }

    return Material;
})();

// Object to manage combining materials inside of material containers
const MaterialManager = (function() {
    const MaterialManager = Object.create(null);

    const singleNameRecipes = []; // Array of the recipes with only one name to match
    const multipleNameRecipes = []; // Array of the recipes with multiple names to match
    const singleNameMap = new WeakMap(); // A map whose keys are recipes with only one name
    const multipleNameMap = new WeakMap(); // A map whose keys are recipes with multiple names
    const nameMap = Object.create(null); // An object whose keys are names and whose values are arrays of recipes with that name

    // Creates and returns a wrapper function for the given callback that validates the callback's given materials and results
    const createSafetyWrapper = function(names, callback) {
        const wrapper = function(materials) {
            names.forEach(function(name, i) {
                if (name !== materials[i].name) {
                    throw new Error("The given material does not match the recipe's name!");
                }
            });
            const results = callback(materials);
            if (names.length === 1) {
                if (results.length > 1) {
                    throw new Error("Multiple materials returned when only one was expected!");
                }
                if (names[0].name === results[0].name) {
                    throw new Error("A recipe with a single name must return a single material with that same name!");
                }
            }
            return results;
        }
        return wrapper;
    }

    /**
     * Creates a recipe used to combine materials
     * 
     * @param names       A list of names to name in order to operate the recipe on
     * @param callback     A string, either javascript or SugarCube script, to evaluate
     */
    const Recipe = function(names, callback) {
        const namesSeen = Object.create(null);
        names.forEach(function(name) {
            if (typeof name !== "string") {
                throw new Error("All recipe names must be strings!");
            } else if (namesSeen[name]) {
                throw new Error("A recipe cannot match the same material more than once");
            } else {
                namesSeen[name] = true;
            }
        });

        const recipe = Object.create(Recipe.prototype);
        recipe.names = names;
        recipe.callback = createSafetyWrapper(names, callback);

        if (recipe.names.length === 1) {
            singleNameRecipes.push(recipe);
            singleNameMap.set(recipe, true);
        } else if (recipe.names.length > 1) {
            multipleNameRecipes.push(recipe);
            multipleNameMap.set(recipe, true);
        }
        recipe.names.forEach(function(name) {
            if (!nameMap[name]) {
                nameMap[name] = [];
            }
            nameMap[name].push(recipe);
        });

        return recipe;
    }

    Recipe.prototype.evaluate = function(materials) {
        return this.callback(clone(materials));
    }

    /**
     * Add a recipe to the material manager
     * 
     * @param names            An array of material names to match
     * @param callback          A callback that processes the materials matched
     */
    MaterialManager.addRecipe = function(names, callback) {
        const recipe = Recipe(names, callback);
    }

    /**
     * Applies the manager's set of recipes to an array of materials
     * 
     * @param contents      An array of materials
     */
    MaterialManager.evaluateContents = function(contents) {
        let reevaluationRequired = false;

        // Create a map of the contents where the material names are the keys and the array of materials are the values
        const contentMap = Object.create(null);
        contents.forEach(function(material) {
            const name = material.name;
            if (!contentMap[name]) {
                contentMap[name] = [];
            }
            contentMap[name].push(material);
        });

        // Loop through content map, combining like materials
        // Combining materials does not require another 
        Object.keys(contentMap).forEach(function(name) {
            const materials = contentMap[name];
            let result;

            // If there are multiple of the same material, combine them, otherwise, just unwrap the array
            if (materials.length > 1) {
                result = combineLike(materials);
            } else {
                result = materials[0];
            }
            contentMap[name] = result;
        });

        // Loop through all multiple name recipes looking for and evaluating matches
        multipleNameRecipes.forEach(function(recipe) {
            // Create materials array to pass to the recipe's evaluate function
            const materials = [];

            // Check to see if the recipe can be evaluated
            // It can be evaluated if each name in its name array is found as a property on contentMap
            const canEvaluate = recipe.names.every(function(name) {
                // Retrieve the material from contentMap, push it to the materials array, and return it
                const material = contentMap[name];
                materials.push(material);
                return material;
            });

            // If the recipe can be evaluated, set reevaluationRequired to true
            // Delete the consumed materials from contentMap, and add the resulting materials to contentMap
            if (canEvaluate) {
                reevaluationRequired = true;
                let newMaterials = recipe.evaluate(materials);
                recipe.names.forEach(function(name) {
                    delete contentMap[name];
                });
                newMaterials.forEach(function(newMaterial) {
                    if (newMaterial.volume > 0 || newMaterial.mass > 0) {
                        const name = newMaterial.name;
                        const existingMaterial = contentMap[name];
                        if (existingMaterial) {
                            newMaterial = combineLike([existingMaterial, newMaterial]);
                        }
                        contentMap[name] = newMaterial;
                    }
                });
            }
        });

        // Dump contentMap's properties into a newContents array
        const newContents = Object.keys(contentMap).map(function(key) {
            return contentMap[key];
        });

        // If the reevaluationRequired flag is true, reevaluate the newly produced contents, otherwise return them
        if (reevaluationRequired) {
            return MaterialManager.evaluateContents(newContents);
        } else {
            return newContents;
        }
    }

    /**
     * Combines an array of like materials (matching names)
     * Attempts to find a single name rule to combine the materials
     * If no rule is found, the function defaults to the Material.prototype.combineLike function
     * 
     * @param materials 
     */
    const combineLike = function(materials) {
        // Find the first single name recipe that matches the name
        const name = materials[0].name;
        let recipe;
        if (nameMap[name]) {
            recipe = nameMap[name].find(function(recipe) {
                return singleNameMap.has(recipe);
            });
        }

        // If a recipe is found, use it to combine the matching material
        // Otherwise, use the default Material.prototype.combineLike function
        const result = materials.reduce(function(combined, material) {
            if (recipe) {
                return recipe.evaluate([combined, material])[0];
            } else {
                return combined.combineLike(material);
            }
        });

        return result;
    }

    // Add SugarCube interface for adding recipes
    Macro.add("addRecipe", {
        tags: null,
        handler() {
            //console.log(this);
            const that = this;
            const args = this.args;
            const content = this.payload[0].contents.trim();
            if (content !== "") {
                // Create callback recipe function
                let callback;
                if (args[args.length - 1] === "JS") {
                    args.pop();
                    callback = Function("materials", content);
                } else {
                    this.addShadow("$reactants", "$products");
                    let reactantsCache;
                    let productsCache;
                    const shadowWrapped = this.createShadowWrapper(function(reactants) {
                        reactantsCache = State.variables.reactants;
                        productsCache = State.variables.products;
                        State.variables.reactants = reactants;
                        State.variables.products = [];
                        Wikifier.wikifyEval(content);
                    });
                    callback = function(reactants) {
                        shadowWrapped(reactants);
                        const products = State.variables.products;
                        if (reactantsCache !== undefined) {
                            State.variables.reactants = reactantsCache;
                        } else {
                            delete State.variables.reactants;
                        }
                        if (productsCache !== undefined) {
                            State.variables.products = productsCache;
                        } else {
                            delete State.variables.products;
                        }
                        return products;
                    }
                    MaterialManager.addRecipe(args, callback);
                }

                // Add recipe
                try {
                    MaterialManager.addRecipe(args, callback);
                } catch(e) {
                    this.error(e);
                }
            }
        }
    });

    return MaterialManager;
})();

window.MaterialManager = MaterialManager;
window.Material = Material;

// Callback macros
(function() {
    const triggerCallbacks = function(ids, args) {
        const store = State.temporary["_callbacks"];
        if (store) {
            if (typeof ids === "string") {
                ids = [ids];
            }
            ids.forEach(function(id) {
                if (store[id]) {
                    store[id].forEach(function(callback) {
                        try {
                            callback(args);
                        } catch(e) {
                            console.log(e);
                        }
                    });
                }
            })
        }
    }

    /* SugarCube code block to be executed later */
    Macro.add("callback", {
        tags: null,
        isAsync: true,
        validIdRe: /^[A-Za-z_]\w*$/,
        handler() {
            // Make sure arguments are given
            if (this.args.length === 0) {
                return this.error("Missing callback ID(s).");
            }

            // Determine whether to run the callback as javascript
            let isJS = false;
            if (this.args[this.args.length] === "JS") {
                isJS = true;
                this.args.pop();
            }

            // Check callback IDs
            const ids = Array.from(this.args);
            const wrongId = ids.find((id) => typeof id !== "string" || !id.match(this.self.validIdRe))
            if (!!wrongId) {
                return this.error("The value " + JSON.stringify(wrongId) + " isn't a valid ID.");
            }
            
            // Create callback function and store it in a temporary variable
            const content = this.payload[0].contents.trim();
            if (content !== "") {
                // Create callback
                let callback;
                if (isJS) {
                    callback = Function("args", content);
                } else {
                    this.addShadow("$args");
                    callback = this.createShadowWrapper(function(args) {
                        const argsCache = State.variables.args;
                        State.variables.args = args;
                        Wikifier.wikifyEval(content);
                        if (argsCache !== undefined) {
                            State.variables.args = argsCache;
                        } else {
                            delete State.variables.args;
                        }
                    });
                }

                // Add callback to store
                const store = State.temporary["_callbacks"] = State.temporary["_callbacks"] || {};
                ids.forEach((id) => {
                    if(!store[id]) {
                        store[id] = [];
                    }
                    store[id].push(callback);
                });
            }
        }
    });

    /* trigger some handler from before */
    Macro.add("trigger", {
        validIdRe: /^[A-Za-z_]\w*$/,
        handler() {
            if (this.args.length === 0) {
                return this.error("Missing callback ID(s).");
            }
            const ids = (this.args[0] instanceof Array ? this.args[0].map((id) => String(id)) : [String(this.args[0])]);
            const wrongId = ids.find((id) => typeof id !== 'string' || !id.match(this.self.validIdRe))
            if (!!wrongId) {
                return this.error("The value " + JSON.stringify(wrongId) + " isn't a valid ID.");
            }
            triggerCallbacks(ids, this.args.slice(1));
        }
    });
})();

// the <<done>> macro, v1.0.1; for SugarCube 2, by chapel
(function () {
    // the core function
    Macro.add("done", {
        skipArgs: true,
        tags: null,
        handler() {        
            const content = this.payload[0].contents.trim();
            if (content === "") {
                return; // bail
            }

            const that = this;
            $(document).on(":passagedisplay", function(e) {
                Wikifier.wikifyEval(content);
            });
        }
    });
}());
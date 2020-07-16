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
        if (!states[this.getKey()]) {
            // Create internal object state
            const state = Object.create(null);
            states[this.getKey()] = state;
            
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
        const state = states[this.getKey()];
        const callbacks = state.callbacks;
        
        // Add event name arrays to callback object
        eventNames.forEach(function(eventName) {
            if (!callbacks[eventName]) {
                callbacks[eventName] = [];
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
        const state = states[this.getKey()];
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
        const state = states[this.getKey()];
        const callbacks = state.callbacks;
        
        // Input validation
        if (!callback) throw new Error("A callback function must be provided");
        
        // Add callback
        if (callbacks[eventName]) {
            callbacks[eventName].push(callback);
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
        const state = states[this.getKey()];
        const callbacks = state.callbacks;
        
        // Input validation
        if (!callback) throw new Error("A callback function must be provided");
        let callbackIndex = callbacks[eventName].indexOf(callback);
        
        // Remove callback
        if (callbackIndex !== -1) {
            callbacks[eventName].splice(callbackIndex, 1);
        }
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
        return states[this.getKey()].callbacks[eventName];
    }
    
    /**
     * Return a copy of the array of all event names
     *
     * @return				The copy of the array of all event names
     */
    EventDispatcher.prototype.getEventNames = function() {
        // Retrieve internal state
        return states[this.getKey()].eventNames;
    }

    EventDispatcher.prototype.hasEvent = function(eventName) {
        return Boolean(states[this.getKey()].callbacks[eventName]);
    }

    Macro.add("on", {
        tags: [],
        handler() {
            // Find first macro context whose first argument is an EventDispatcher
            const eventContext = this.contextSelect(function(context) {
                return context.args[0] && context.args[0].addEventListener === EventDispatcher.prototype.addEventListener;
            });

            // Make sure eventContext is not null
            if (eventContext === null) {
                throw new Error("'on' macro must have a parent context whose first argument is an instance of EventDispatcher");
            }
            const parentObject = eventContext.args[0];

            // Check if the instance of EventDispatcher has the given event name
            const eventName = String(this.args[0]);
            if (!parentObject.hasEvent(eventName)) {
                throw new Error("Parent object does not have an event named " + eventName);
            }

            // Create and add callback function
            const that = this;
            const isJS = this.args[1] === "JS";
            let callback;
            if (isJS) {
                callback = Function("event", this.payload[0].contents);
            } else {
                let content = this.payload[0].contents.trim();
                if (content !== "") {
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
            }
            if (callback) {
                parentObject.addEventListener(eventName, callback);
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
        if (this.singleItem && this.contents.length > 0) {
            this.removeAll();
        }
        this.contents.push(item.getKey());

        const e = Object.create(null);
        e.parent = this;
        e.itemAdded = item;
        this.dispatchEvent(LEvent("itemadded", e));
    }

    EquipmentContainer.prototype.indexOf = function(item) {
        return this.contents.indexOf(item.getKey());
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
        tags: ["offset", "singleItem", "decimalPlaces", "displayName", "displayContents"],
        handler() {
            console.log(this);
            if (this.args.length !== 1) {
                throw new Error("Balance macro requires a single argument");
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
            let that = this;
            this.payload.forEach(function(chunk) {
                if (chunk.name === "offset") {
                    parentObject.offset = Number(chunk.args[0]);
                } else if (chunk.name === "singleItem") {
                    parentObject.singleItem = Boolean(chunk.args[0]);
                } else if (chunk.name === "decimalPlaces") {
                    parentObject.decimalPlaces = Number(chunk.args[0]);
                } else if (chunk.name === "displayName") {
                    parentObject.displayName = String(chunk.args[0]);
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
        this.defineEvents(["materialadded", "materialremoved", "emptied", "overflow"]);
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
            contentMass += material.getMass();
            return volume + material.getVolume();
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
        const surplus = (this.volume + material.getVolume()) - this.capacity;
        if (surplus > 0) {
            const e = Object.create(null);
            e.parent = this;
            e.materialAdded = material;
            this.dispatchEvent(LEvent("overflow", e));
            return;
        }

        this.contents.push(material);

        const e = Object.create(null);
        e.parent = this;
        e.materialAdded = material;
        e.previousVolume = this.volume;
        e.previousContents = this.contents;

        this.contents = MaterialManager.evaluateContents(clone(this.contents));
        updateMeasurements.call(this);

        this.dispatchEvent(LEvent("materialadded", e));
    }

    MaterialContainer.prototype.indexOf = function(material) {
        return this.contents.indexOf(material);
    }

    const indexOfLabel = function(label) {
        return this.contents.findIndex(function(material) {
            return material.label === label;
        });
    }

    MaterialContainer.prototype.remove = function(label) {
        var index = indexOfLabel.call(this, label);
		if (index != -1) {
			return this.removeIndex(index);
		}
		return null;
    }

    MaterialContainer.prototype.has = function(label) {
        return indexOfLabel.call(this, label) !== -1;
    }

    MaterialContainer.prototype.get = function(label) {
        const index = indexOfLabel.call(this, label);
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
        
        this.volume -= materialRemoved.getVolume();
        this.contentMass -= materialRemoved.getMass();

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
        tags: ["restMass", "capacity", "displayName", "addMaterial", "emptyInto"],
        handler() {
            console.log(this);
            if (this.args.length !== 1) {
                throw new Error("Container macro requires a single argument");
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
            let that = this;
            this.payload.forEach(function(chunk) {
                if (chunk.name === "restMass") {
                    parentObject.restMass = Number(chunk.args[0]);
                } else if (chunk.name === "capacity") {
                    parentObject.capacity = Number(chunk.args[0]);
                } else if (chunk.name === "displayName") {
                    parentObject.displayName = String(chunk.args[0]);
                } else if (chunk.name === "addMaterial") {
                    const material = chunk.args[0];
                    if (!(material instanceof Material)) {
                        throw new Error("addMaterial argument must be an instance of Material");
                    }
                    parentObject.add(material);
                } else if (chunk.name === "emptyInto") {
                    parentObject.emptyInto(chunk.args[0]);
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
        if (!states[this.getKey()]) {
            const state = Object.create(null);
            states[this.getKey()] = state;
        }
    }

    const GraduatedCylinder = function(key) {
        if (!this) {
            const graduatedCylinder = Object.create(GraduatedCylinder.prototype);
        }
    }
    GraduatedCylinder.inheritFrom(MaterialContainer);
})();

const Material = (function() {
    const populate = function(config) {
        this.label = config.label;
        if (config.solid) {
            this.mass = config.mass;
        } else {
            this.volume = config.volume;
        }
        this.density = config.density;
        this.solid = config.solid;
    }

    const Material = function(label, volume, density, solid = false) {
        if (!this) {
            const material = Object.create(Material.prototype);
            Material.call(material, ...arguments);
            return material;
        }
        Cloneable.call(this);

        const config = Object.create(null);
        config.label = label;
        if (solid) {
            config.mass = volume;
        } else {
            config.volume = volume;
        }
        config.density = density;
        config.solid = solid;
        populate.call(this, config);
    }
    Material.inheritFrom(Cloneable);
    Cloneable.setupConstructor(Material, "Material");

    Material.prototype.splitOff = function(percentage) {
        const newMaterial = Object.create(Material.prototype);
        Cloneable.call(newMaterial);
        
        Object.assign(newMaterial, this);
        if (this.solid) {
            newMaterial.mass *= percentage;
            this.mass *= (1 - percentage);
        } else {
            newMaterial.volume *= percentage;
            this.volume *= (1 - percentage);
        }

        return newMaterial;
    }

    Material.prototype.combineLike = function(material) {
        if (material.label === this.label) {
            if (this.solid) {
                this.mass += material.mass;
                material.mass = 0;
            } else {
                this.volume += material.volume;
                material.volume = 0;
            }
        }
        return this;
    }

    Material.prototype.getMass = function() {
        if (this.solid) {
            return this.mass;
        } else {
            return this.density * this.volume;
        }
    }

    Material.prototype.getVolume = function() {
        if (this.solid) {
            return this.mass / this.density;
        } else {
            return this.volume;
        }
    }

    Material.fromObj = function(obj) {
        if (this === Material) {
            const material = Object.create(Material.prototype);
            Object.assign(material, obj);
            Material.fromObj.call(material, obj);
            return material;
        }
        Cloneable.fromObj.call(this, obj);
        Object.assign(this, obj);
    }

    return Material;
})();

// Object to manage combining materials inside of material containers
const MaterialManager = (function() {
    const MaterialManager = Object.create(null);

    const singleLabelRecipes = []; // Array of the recipes with only one label to match
    const multipleLabelRecipes = []; // Array of the recipes with multiple labels to match
    const singleLabelMap = new WeakMap(); // A map whose keys are recipes with only one label
    const multipleLabelMap = new WeakMap(); // A map whose keys are recipes with multiple labels
    const labelMap = Object.create(null); // An object whose keys are labels and whose values are arrays of recipes with that label

    // Creates and returns a wrapper function for the given callback that validates the callback's given materials and results
    const createSafetyWrapper = function(labels, callback) {
        const wrapper = function(materials) {
            labels.forEach(function(label, i) {
                if (label !== materials[i].label) {
                    throw new Error("The given material does not match the recipe's label!");
                }
            });
            const results = callback(materials);
            if (labels.length === 1) {
                if (results.length > 1) {
                    throw new Error("Multiple materials returned when only one was expected!");
                }
                if (labels[0].label === results[0].label) {
                    throw new Error("A recipe with a single label must return a single material with that same label!");
                }
            }
            return results;
        }
        return wrapper;
    }

    /**
     * Creates a recipe used to combine materials
     * 
     * @param labels       A list of labels to label in order to operate the recipe on
     * @param callback     A string, either javascript or SugarCube script, to evaluate
     */
    const Recipe = function(labels, callback) {
        const labelsSeen = Object.create(null);
        labels.forEach(function(label) {
            if (typeof label !== "string") {
                throw new Error("All recipe labels must be strings!");
            } else if (labelsSeen[label]) {
                throw new Error("A recipe cannot match the same material more than once");
            } else {
                labelsSeen[label] = true;
            }
        });

        const recipe = Object.create(Recipe.prototype);
        recipe.labels = labels;
        recipe.callback = createSafetyWrapper(labels, callback);

        if (recipe.labels.length === 1) {
            singleLabelRecipes.push(recipe);
            singleLabelMap.set(recipe, true);
        } else if (recipe.labels.length > 1) {
            multipleLabelRecipes.push(recipe);
            multipleLabelMap.set(recipe, true);
        }
        recipe.labels.forEach(function(label) {
            if (!labelMap[label]) {
                labelMap[label] = [];
            }
            labelMap[label].push(recipe);
        });

        return recipe;
    }

    Recipe.prototype.evaluate = function(materials) {
        return this.callback(clone(materials));
    }

    /**
     * Add a recipe to the material manager
     * 
     * @param labels            An array of material labels to match
     * @param callback          A callback that processes the materials matched
     */
    MaterialManager.addRecipe = function(labels, callback) {
        const recipe = Recipe(labels, callback);
    }

    /**
     * Applies the manager's set of recipes to an array of materials
     * 
     * @param contents      An array of materials
     */
    MaterialManager.evaluateContents = function(contents) {
        let reevaluationRequired = false;

        // Create a map of the contents where the material labels are the keys and the array of materials are the values
        const contentMap = Object.create(null);
        contents.forEach(function(material) {
            const label = material.label;
            if (!contentMap[label]) {
                contentMap[label] = [];
            }
            contentMap[label].push(material);
        });

        // Loop through content map, combining like materials
        // Combining materials does not require another 
        Object.keys(contentMap).forEach(function(label) {
            const materials = contentMap[label];
            let result;

            // If there are multiple of the same material, combine them, otherwise, just unwrap the array
            if (materials.length > 1) {
                result = combineLike(materials);
            } else {
                result = materials[0];
            }
            contentMap[label] = result;
        });

        // Loop through all multiple label recipes looking for and evaluating matches
        multipleLabelRecipes.forEach(function(recipe) {
            // Create materials array to pass to the recipe's evaluate function
            const materials = [];

            // Check to see if the recipe can be evaluated
            // It can be evaluated if each label in its label array is found as a property on contentMap
            const canEvaluate = recipe.labels.every(function(label) {
                // Retrieve the material from contentMap, push it to the materials array, and return it
                const material = contentMap[label];
                materials.push(material);
                return material;
            });

            // If the recipe can be evaluated, set reevaluationRequired to true
            // Delete the consumed materials from contentMap, and add the resulting materials to contentMap
            if (canEvaluate) {
                reevaluationRequired = true;
                let newMaterials = recipe.evaluate(materials);
                recipe.labels.forEach(function(label) {
                    delete contentMap[label];
                });
                newMaterials.forEach(function(newMaterial) {
                    if (newMaterial.getVolume() > 0 || newMaterial.getMass() > 0) {
                        const label = newMaterial.label;
                        const existingMaterial = contentMap[label];
                        if (existingMaterial) {
                            newMaterial = combineLike([existingMaterial, newMaterial]);
                        }
                        contentMap[label] = newMaterial;
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
     * Combines an array of like materials (matching labels)
     * Attempts to find a single label rule to combine the materials
     * If no rule is found, the function defaults to the Material.prototype.combineLike function
     * 
     * @param materials 
     */
    const combineLike = function(materials) {
        // Find the first single label recipe that matches the label
        const label = materials[0].label;
        let recipe;
        if (labelMap[label]) {
            recipe = labelMap[label].find(function(recipe) {
                return singleLabelMap.has(recipe);
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

        console.log("Combine like result", result);

        return result;
    }

    // Add SugarCube interface for adding recipes
    Macro.add("addRecipe", {
        tags: [],
        handler() {
            console.log(this);
            const that = this;
            const args = this.args;
            if (args[args.length - 1] === "JS") {
                args.pop();
                MaterialManager.addRecipe(args, Function("materials", this.payload[0].contents));
            } else {
                const content = this.payload[0].contents.trim();
                if (content !== "") {
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
                    const callback = function(reactants) {
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
            }
        }
    });

    return MaterialManager;
})();

window.MaterialManager = MaterialManager;
window.Material = Material;
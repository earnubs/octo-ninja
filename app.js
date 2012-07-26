YUI().use('event-focus', 'json', 'model', 'model-list', 'view', function (Y) {
    var FileAppView, FileList, FileModel, FileView;

    // -- Model --------------------------------------------------------------------

    FileModel = Y.FileModel = Y.Base.create('fileModel', Y.Model, [], {
        sync: LocalStorageSync('file'),

    }, {
        ATTRS: {
            name: {value: ''},
            type: {value: 'foo'}
        }
    });


    // -- ModelList ----------------------------------------------------------------

    FileList = Y.FileList = Y.Base.create('fileList', Y.ModelList, [], {
        model: FileModel,

        sync: LocalStorageSync('file')

    });


    // -- File App View ------------------------------------------------------------

    FileAppView = Y.FileAppView = Y.Base.create('fileAppView', Y.View, [], {
        events: {
            // Handle <enter> keypresses on the "new file" input field.
            '#new-file': {keypress: 'createFile'},

            // Add and remove hover states on file items.
            '.file-item': {
                mouseover: 'hoverOn',
                mouseout : 'hoverOff'
            }
        },

        initializer: function () {
            var list = this.fileList = new FileList();

            list.after('add', this.add, this);
            list.after('reset', this.reset, this);

            list.after(['add', 'reset', 'remove'],
                       this.render, this);

            list.load();
        },

        //render: function () {
        //},

        // -- Event Handlers -------------------------------------------------------

        // Creates a new FileView instance and renders it into the list whenever a
        // file item is added to the list.
        add: function (e) {
            var view = new FileView({model: e.model});

            this.get('container').one('#file-list').append(
                view.render().get('container')
            );
        },

        // Removes all finished file items from the list.
        clearDone: function (e) {
            var done = this.fileList.done();

            e.preventDefault();

            // Remove all finished items from the list, but do it silently so as not
            // to re-render the app view after each item is removed.
            this.fileList.remove(done, {silent: true});

            // Destroy each removed FileModel instance.
            Y.Array.each(done, function (file) {
                // Passing {remove: true} to the file model's `destroy()` method
                // tells it to delete itself from localStorage as well.
                file.destroy({remove: true});
            });

            // Finally, re-render the app view.
            this.render();
        },

        // Creates a new file item when the enter key is pressed in the new file
        // input field.
        createFile: function (e) {
            var inputNode, value;

            if (e.keyCode === 13) { // enter key
                inputNode = this.get('inputNode');
                value     = Y.Lang.trim(inputNode.get('value'));

                if (!value) { return; }

                // This tells the list to create a new FileModel instance with the
                // specified name and automatically save it to localStorage in a
                // single step.
                this.fileList.create({name: value});

                inputNode.set('value', '');
            }
        },

        // Turns off the hover state on a file item.
        hoverOff: function (e) {
            e.currentTarget.removeClass('file-hover');
        },

        // Turns on the hover state on a file item.
        hoverOn: function (e) {
            e.currentTarget.addClass('file-hover');
        },

        // Creates and renders views for every file item in the list when the entire
        // list is reset.
        reset: function (e) {
            var fragment = Y.one(Y.config.doc.createDocumentFragment());

            Y.Array.each(e.models, function (model) {
                var view = new FileView({model: model});
                fragment.append(view.render().get('container'));
            });

            this.get('container').one('#file-list').setHTML(fragment);
        }
    }, {
        ATTRS: {
            // The container node is the wrapper for this view. All the view's
            // events will be delegated from the container. In this case, the
            // #file-app node already exists on the page, so we don't need to create
            // it.
            container: {
                valueFn: function () {
                    return '#file-app';
                }
            },

            // This is a custom attribute that we'll use to hold a reference to the
            // "new file" input field.
            inputNode: {
                valueFn: function () {
                    return Y.one('#new-file');
                }
            }
        }
    });


    // -- File item view -----------------------------------------------------------

    // The FileView class extends Y.View and customizes it to represent the content
    // of a single file item in the list. It also handles DOM events on the item to
    // allow it to be edited and removed from the list.

    FileView = Y.FileView = Y.Base.create('fileView', Y.View, [], {
        // This customizes the HTML used for this view's container node.
        containerTemplate: '<li class="file-item"/>',

        // Delegated DOM events to handle this view's interactions.
        events: {

            '.file-content': {
                click: 'edit',
                focus: 'edit'
            },

            '.file-input'   : {
                blur    : 'save',
                keypress: 'enter'
            },

            '.file-remove': {click: 'remove'}
        },

        // meant to be overridden
        template: Y.one('#file-item-template').getHTML(),

        initializer: function () {
            var model = this.get('model');

            model.after('change', this.render, this);

            model.after('destroy', function () {
                this.destroy({remove: true});
            }, this);
        },

        render: function () {
            var container = this.get('container'),
                model     = this.get('model');


            container.setHTML(Y.Lang.sub(this.template, {
                name   : model.getAsHTML('name'),
                type   : model.getAsHTML('type')
            }))
            this.set('inputNode', container.one('.file-input'));

            return this;
        },

        // -- Event Handlers -------------------------------------------------------

        // Toggles this item into edit mode.
        edit: function () {
            this.get('container').addClass('editing');
            this.get('inputNode').focus();
        },

        // When the enter key is pressed, focus the new file input field. This
        // causes a blur event on the current edit field, which calls the save()
        // handler below.
        enter: function (e) {
            if (e.keyCode === 13) { // enter key
                Y.one('#new-file').focus();
            }
        },

        // Removes this item from the list.
        remove: function (e) {
            e.preventDefault();

            this.constructor.superclass.remove.call(this);
            this.get('model').destroy({'delete': true});
        },

        // Toggles this item out of edit mode and saves it.
        save: function () {
            this.get('container').removeClass('editing');
            this.get('model').set('name', this.get('inputNode').get('value')).save();
        }

    });


    // -- localStorage Sync Implementation -----------------------------------------

    // This is a simple factory function that returns a `sync()` function that can
    // be used as a sync layer for either a Model or a ModelList instance. The
    // FileModel and FileList instances above use it to save and load items.

    function LocalStorageSync(key) {
        var localStorage;

        if (!key) {
            Y.error('No storage key specified.');
        }

        if (Y.config.win.localStorage) {
            localStorage = Y.config.win.localStorage;
        }

        // Try to retrieve existing data from localStorage, if there is any.
        // Otherwise, initialize `data` to a pre defined list.
        var data = Y.JSON.parse((localStorage && localStorage.getItem(key)) || '{}');

        // Delete a model with the specified id.
        function destroy(id) {
            var modelHash;

            if ((modelHash = data[id])) {
                delete data[id];
                save();
            }

            return modelHash;
        }

        // Generate a unique id to assign to a newly-created model.
        function generateId() {
            var id = '',
            i  = 4;

            while (i--) {
                id += (((1 + Math.random()) * 0x10000) | 0)
                .toString(16).substring(1);
            }

            return id;
        }

        // Loads a model with the specified id. This method is a little tricky,
        // since it handles loading for both individual models and for an entire
        // model list.
        //
        // If an id is specified, then it loads a single model. If no id is
        // specified then it loads an array of all models. This allows the same sync
        // layer to be used for both the FileModel and FileList classes.
        function get(id) {
            return id ? data[id] : Y.Object.values(data);
        }

        // Saves the entire `data` object to localStorage.
        function save() {
            localStorage && localStorage.setItem(key, Y.JSON.stringify(data));
        }

        // Sets the id attribute of the specified model (generating a new id if
        // necessary), then saves it to localStorage.
        function set(model) {
            var hash        = model.toJSON(),
            idAttribute = model.idAttribute;

            if (!Y.Lang.isValue(hash[idAttribute])) {
                hash[idAttribute] = generateId();
            }

            data[hash[idAttribute]] = hash;
            save();

            return hash;
        }

        // Returns a `sync()` function that can be used with either a Model or a
        // ModelList instance.
        return function (action, options, callback) {
            // `this` refers to the Model or ModelList instance to which this sync
            // method is attached.
            var isModel = Y.Model && this instanceof Y.Model;

            switch (action) {
                case 'create': // intentional fallthru
                    case 'update':
                    callback(null, set(this));
                return;

                case 'read':
                    callback(null, get(isModel && this.get('id')));
                return;

                case 'delete':
                    callback(null, destroy(isModel && this.get('id')));
                return;
            }
        };
    }


    // -- Start your engines! ------------------------------------------------------

    // Finally, all we have to do is instantiate a new FileAppView to set everything
    // in motion and bring our file list into existence.
    new FileAppView();

});

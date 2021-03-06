/**
 * Prepros
 * (c) Subash Pathak
 * sbshpthk@gmail.com
 * License: MIT
 */

/*jshint browser: true, node: true*/
/*global prepros,  _*/

//Storage
prepros.factory('projectsManager', function (config, storage, fileTypes, notification, utils, $rootScope, $location) {

    'use strict';

    var fs = require('fs'),
        path = require('path'),
        _id = utils.id;

    //Projects List
    var projects = storage.getProjects();

    //Files List
    var files = storage.getFiles();

    //Imports List
    var imports = storage.getImports();

    var _broadCast = function () {
        $rootScope.$broadcast('dataChange', {projects: projects, files: files, imports: imports});
    };

    //Remove any project that no longer exists
    _.each(projects, function (project) {

        if (!fs.existsSync(project.path)) {

            removeProject(project.id);
        }

    });

    //Remove any file that no longer exists
    _.each(files, function (file) {

        if (!fs.existsSync(file.input)) {

            removeFile(file.id);
        }

    });


    //Remove any import that no longer exists
    _.each(imports, function (imported) {

        if (!fs.existsSync(imported.path)) {

            removeImport(imported.path);
        }

    });

    //Function to add new project
    function addProject(folder) {

        //Check if folder already exists in project list
        var already = _.isEmpty(_.findWhere(projects, {path: folder})) ? false : true;

        //If project doesn't exist
        if (!already) {

            //Project to push
            var project = {
                id: _id(folder),
                name: path.basename(folder),
                path: folder,
                config: {
                    liveRefresh: true,
                    serverUrl: _id(folder),
                    filterPatterns: '',
                    useCustomServer: false,
                    customServerUrl: '',
                    cssPath: config.getUserOptions().cssPath,
                    jsPath: config.getUserOptions().jsPath,
                    htmlPath: config.getUserOptions().htmlPath,
                    jsMinPath: config.getUserOptions().jsMinPath
                }
            };

            var serverUrl = project.name.replace(/\s/gi, '-').replace(/[^a-zA-Z0-9\-_]/g, '');

            var urlNotUsed = function(url) {

                return _.isEmpty(_.find(projects, function(p){ return p.config.serverUrl === url; }));
            };

            if(serverUrl !== '') {

                if (urlNotUsed(serverUrl)) {

                    project.config.serverUrl = serverUrl;

                } else {

                    for (var i=1; i<6; i++) {

                        var newUrl = serverUrl + '-' + i;

                        if(urlNotUsed(newUrl)) {
                            project.config.serverUrl = newUrl;
                            break;
                        }
                    }
                }
            }

            //Push project to projects list
            projects.push(project);

            refreshProjectFiles(project.id);

            //Redirect to newly added project
            $location.path('/files/' + _id(folder));

            _broadCast();
        }
    }

    //Function to remove project
    function removeProject(pid) {

        if (!_.isEmpty(_.findWhere(projects, {id: pid}))) {

            //Reject projects from list
            projects = _.reject(projects, function (project) {
                return project.id === pid;
            });

            removeProjectFiles(pid);
        }

        _broadCast();
    }

    //function to get all project files
    function getProjectFiles(pid) {
        return _.where(files, {pid: pid});
    }

    //Function to get current Project config
    function getProjectConfig(pid) {
        return getProjectById(pid).config;
    }

    //Function to remove project files
    function removeProjectFiles(pid) {

        if (!_.isEmpty(_.where(files, {pid: pid}))) {

            //Reject the file from list
            files = _.reject(files, function (file) {
                return file.pid === pid;
            });

            //Reject the imports from list
            imports = _.reject(imports, function (imp) {
                return imp.pid === pid;
            });
        }

        _broadCast();
    }

    //Function to get project by it's id
    function getProjectById(id) {
        return _.findWhere(projects, {id: id});
    }

    //Function to get file by its id
    function getFileById(id) {
        return _.findWhere(files, {id: id});
    }

    //Function to get file by its id
    function getImportById(id) {
        return _.findWhere(imports, {id: id});
    }

    //Function to remove a file
    function removeFile(id) {

        if (!_.isEmpty(_.findWhere(files, {id: id}))) {

            //Reject the file from list
            files = _.reject(files, function (file) {
                return file.id === id;
            });

            //Remove file from imports parent list
            removeParentFromAllImports(id);

            _broadCast();
        }

    }

    //Function to remove a import file
    function removeImport(id) {

        if (!_.isEmpty(_.findWhere(imports, {id: id}))) {

            //Reject import from imports list
            imports = _.reject(imports, function (imp) {
                return imp.id === id;
            });
        }


        _broadCast();
    }

    //Function to get file imports in imports list
    function getFileImports(fid) {

        return _.filter(imports, function (im) {
            return _.contains(im.parents, fid);
        });
    }


    //Function to remove file from import parent
    function removeParentFromAllImports(fid) {

        _.each(imports, function (imp) {

            removeImportParent(imp.id, fid);

        });

    }

    //Remove parent from certain import
    function removeImportParent(impid, fid) {

        var imported = _.findWhere(imports, {id: impid});

        var newImports = _.reject(imports, function (imp) {

            return imported.path === imp.path;

        });

        imported.parents = _.without(imported.parents, fid);

        //If after removing one file as parent the parents list becomes empty remove whole import item
        if (!_.isEmpty(imported.parents)) {

            newImports.push(imported);

        }

        imports = newImports;

        _broadCast();
    }

    //Function to get all files inside project folder
    function getProjectFolderFiles(pid) {

        var folder = getProjectById(pid).path;

        var f = [];

        function get(dir) {

            var files = fs.readdirSync(dir);

            files.forEach(function (file) {

                var fp = dir + path.sep + file;

                if (fs.statSync(fp).isDirectory()) {

                    get(fp);

                } else {

                    if (fileTypes.isFileSupported(fp)) {
                        f.push(fp);
                    }
                }
            });
        }

        try {

            get(folder);

        } catch (e) {

            notification.error('Error ! ', 'An error occurred while scanning files', e.message);

        }

        return f;
    }

    //Function to match files against global and project specific filters
    function matchFileFilters(pid, file) {

        var projectFilterPatterns = '';

        if (getProjectById(pid).config.filterPatterns) {

            projectFilterPatterns = getProjectById(pid).config.filterPatterns;
        }

        var globalFilterPatterns = config.getUserOptions().filterPatterns.split(',');

        projectFilterPatterns = projectFilterPatterns.split(',');

        var filterPatterns = _.unique(_.union(globalFilterPatterns, projectFilterPatterns));

        var matchFilter = false;

        _.each(filterPatterns, function (pattern) {

            pattern = pattern.trim();

            if (pattern !== "" && file.indexOf(pattern) !== -1) {

                matchFilter = true;

            }

        });

        return matchFilter;

    }

    //Function to add file
    function addFile(filePath, projectPath, broadCast) {

        //Check if file already exists in files list
        var already = _.isEmpty(_.findWhere(files, {input: filePath})) ? false : true;

        var inImports = _.isEmpty(_.findWhere(imports, {path: filePath})) ? false : true;

        var isFileSupported = fileTypes.isFileSupported(filePath);

        if (isFileSupported && !already && !inImports) {

            files.push(fileTypes.format(filePath, projectPath));
        }

        if (broadCast) {
            _broadCast();
        }

    }

    //Function that refreshes files in a project folder
    function refreshProjectFiles(pid) {

        utils.showLoading();

        var folder = getProjectById(pid).path;

        //Remove file that doesn't exist or matches the filter pattern
        _.each(getProjectFiles(pid), function (file) {

            //Remove if matches filter patterns or doesn't exist
            if (matchFileFilters(pid, file.input) || !fs.existsSync(file.input)) {

                removeFile(file.id);

            }

        });

        if (fs.existsSync(folder)) {

            var projectFiles = getProjectFolderFiles(pid);

            var filesToAdd = [];

            _.each(projectFiles, function (file) {

                if (!matchFileFilters(pid, file)) {

                    filesToAdd.push({
                        path: file,
                        imports: fileTypes.getImports(file)
                    });
                }
            });

            //Check if file is in the imports list of another file
            //If it is ignore the file
            var importsOfAllFiles = _.uniq(_.flatten(_.pluck(filesToAdd, 'imports')));

            _.each(filesToAdd, function (file) {

                //Check
                if (!_.contains(importsOfAllFiles, file.path)) {

                    //Add file
                    addFile(file.path, folder);

                    //Add imports
                    _.each(file.imports, function (imp) {
                        addFileImport(folder, file.path, imp);
                    });
                }

                //Remove any previously imported file that is not imported anymore
                var oldImports = getFileImports(_id(file.path));

                _.each(oldImports, function (imp) {

                    if (!_.contains(file.imports, imp.path)) {

                        removeImportParent(imp.id, _id(file.path));
                    }
                });
            });

            _broadCast();

            utils.hideLoading();

        } else {

            removeProject(pid);

            utils.hideLoading();
        }
    }


    //function to add imported file to import list
    function addFileImport(projectPath, parentPath, importedPath) {

        //If @imported file is not in imports list create new entry otherwise add the file as parent
        if (_.isEmpty(_.findWhere(imports, {path: importedPath}))) {

            imports.push({
                id: _id(importedPath),
                pid: _id(projectPath),
                path: importedPath,
                parents: [_id(parentPath)]
            });

        } else {

            var im = _.findWhere(imports, {path: importedPath});

            if (!_.contains(im.parents, _id(parentPath))) {
                im.parents.push(_id(parentPath));
            }

            //Remove old import file without new parent
            var newImports = _.reject(imports, function (imp) {
                return imp.path === importedPath;
            });

            //Push new import file with new parent
            newImports.push(im);

            //finally add to global imports list
            imports = newImports;

        }

        //Remove any file that is in files list and is imported by this file
        removeFile(_id(importedPath));

    }

    //Function to change file output path
    function changeFileOutput(id, newPath) {

        var file = getFileById(id);

        if (path.extname(path.basename(newPath)) === '') {

            newPath = newPath + fileTypes.getCompiledExtension(file.input);
        }

        file.output = newPath;
    }

    //Return
    return {
        projects: projects,
        files: files,
        imports: imports,

        getProjectById: getProjectById,
        getFileById: getFileById,
        getImportById: getImportById,

        addProject: addProject,
        addFile: addFile,

        removeFile: removeFile,
        removeProject: removeProject,
        removeImport: removeImport,

        refreshProjectFiles: refreshProjectFiles,
        getProjectFiles: getProjectFiles,
        getProjectConfig: getProjectConfig,
        changeFileOutput: changeFileOutput
    };
});

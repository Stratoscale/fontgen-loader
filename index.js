var loaderUtils = require("loader-utils");
var fontgen = require("webfonts-generator");
var path = require("path");
var glob = require('glob');

var mimeTypes = {
    'eot': 'application/vnd.ms-fontobject',
    'svg': 'image/svg+xml',
    'ttf': 'application/x-font-ttf',
    'woff': 'application/font-woff'
};

function absolute(from, to) {
    if (arguments.length < 2) {
        return function (to) {
            return path.resolve(from, to);
        };
    }
    return path.resolve(from, to);
}

function getFilesAndDeps(patterns, context) {
    var files = [];
    var filesDeps = [];
    var directoryDeps = [];

    function addFile(file) {
        filesDeps.push(file);
        files.push(absolute(context, file));
    }

    function addByGlob(globExp) {
        var globOptions = {cwd: context};

        var foundFiles = glob.sync(globExp, globOptions);
        files = files.concat(foundFiles.map(absolute(context)));

        var globDirs = glob.sync(path.dirname(globExp) + '/', globOptions);
        directoryDeps = directoryDeps.concat(globDirs.map(absolute(context)));


    }

    // Re-work the files array.
    patterns.forEach(function (pattern) {
        if (glob.hasMagic(pattern)) {
            addByGlob(pattern);
        }
        else {
            addFile(pattern);
        }
    });

    return {
        files: files,
        dependencies: {
            directories: directoryDeps,
            files: filesDeps
        }
    };

}

module.exports = function (content) {
    this.cacheable();
    var params = loaderUtils.getOptions(this);
    var config;
    try {
        config = JSON.parse(content);
    }
    catch (ex) {
        config = this.exec(content, this.resourcePath);
    }

    config.__dirname = path.dirname(this.resourcePath);

    // Sanity check
    /*
     if(typeof config.fontName != "string" || typeof config.files != "array") {
     this.reportError("Typemismatch in your config. Verify your config for correct types.");
     return false;
     }
     */
    var filesAndDeps = getFilesAndDeps(config.files, this.context);
    filesAndDeps.dependencies.files.forEach(this.addDependency.bind(this));
    filesAndDeps.dependencies.directories.forEach(this.addContextDependency.bind(this));
    config.files = filesAndDeps.files;

    // With everything set up, let's make an ACTUAL config.
    var formats = params.types || ['eot', 'woff', 'ttf', 'svg'];
    if (formats.constructor !== Array) {
        formats = [formats];
    }

    var fontconf = {
        files: config.files,
        fontName: config.fontName,
        types: formats,
        order: formats,
        fontHeight: config.fontHeight || 1000, // Fixes conversion issues with small svgs
        codepoints: config.codepoints,
        templateOptions: {
            baseClass: config.baseClass || "icon",
            classPrefix: config.classPrefix || "icon-"
        },
        rename: (typeof config.rename == "function" ? config.rename : function (f) {
            return path.basename(f, ".svg");
        }),
        dest: "",
        writeFiles: false
    };

    if (config.cssTemplate) {
        fontconf.cssTemplate = absolute(this.context, config.cssTemplate);
    }

    for (var option in config.templateOptions) {
        if (config.templateOptions.hasOwnProperty(option)) {
            fontconf.templateOptions[option] = config.templateOptions[option];
        }
    }

    // svgicons2svgfont stuff
    var keys = [
        "fixedWidth",
        "centerHorizontally",
        "normalize",
        "fontHeight",
        "round",
        "descent"
    ];
    for (var x in keys) {
        if (typeof config[keys[x]] != "undefined") {
            fontconf[keys[x]] = config[keys[x]];
        }
    }

    var cb = this.async();
    var self = this;
    var opts = this.options;
    var pub = (
      opts.output.publicPath || "/"
    );
    var embed = !!params.embed;

    if (fontconf.cssTemplate) {
        this.addDependency(fontconf.cssTemplate)
    }

    fontgen(fontconf, function (err, res) {
        if (err) {
            return cb(err);
        }
        var urls = {};
        for (var i in formats) {
            var format = formats[i];
            if (!embed) {
                var filename = config.fileName || params.fileName || "[hash]-[fontname][ext]";
                filename = filename
                  .replace("[fontname]", fontconf.fontName)
                  .replace("[ext]", "." + format);
                var url = loaderUtils.interpolateName(this,
                  filename,
                  {
                      context: self.options.context || this.context,
                      content: res[format]
                  }
                );
                urls[format] = (pub + url).replace(/\\/g, '/');
                self.emitFile(url, res[format]);
            } else {
                urls[format] = 'data:'
                  + mimeTypes[format]
                  + ';charset=utf-8;base64,'
                  + (new Buffer(res[format]).toString('base64'));
            }
        }
        cb(null, res.generateCss(urls));
    });
};

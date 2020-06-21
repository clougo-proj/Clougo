// usage: node mkut.js <root_dir>

const fs = require("fs");
const { join } = require("path");

const filetype = ["lgo", "ljs", "in", "out", "err", "eval", "parse", "codegen", "draw"];
let root = process.argv[2];

if (!(fs.existsSync(root) && fs.lstatSync(root).isDirectory())) {
    process.stderr.write("node mkjson.js <root_dir> --js\n");
    process.exit();
}

let splittedPath = splitPath(root);
let dir = splittedPath[0];
let parent = splittedPath[1];

process.stdout.write("var $jsonObj = ");

process.stdout.write(encodeDir(dir, parent));

process.stdout.write(";\nif (typeof exports !== \"undefined\") { exports.$jsonObj = $jsonObj; }\n");

function splitPath(path) {
    const pattern = /^(.*)[/\\]([^/\\]+)$/;
    let found = path.match(pattern);
    if (found !== null) {
        return [found[2], found[1]];
    }

    return [path];
}

function encodeDir(dir, parent) {
    let path = (typeof parent === "undefined") ? dir : parent + "/" + dir;
    let dirCases = encodeDirCases(path);

    let subDirs = fs.readdirSync(path)
        .filter(name => fs.statSync(join(path, name)).isDirectory());

    let encodedSubDirs = subDirs.map(subDir => "\"" + subDir + "\": " + encodeDir(subDir, path));

    return "{" + dirCases.concat(encodedSubDirs).join(",") + "}";
}

function encodeDirCases(dir) {
    return getListOfCases(dir).map(testCase => encodeCase(testCase, dir));
}

function encodeCase(testCase, dir) {
    let name = testCase[0];
    let tag = testCase[1];
    let file = [];

    file.push("\"" + name + "\": {\"__tag__\": [");
    file.push(tag.map(t => "\"" + t + "\"").join(", "));
    file.push("]");

    filetype.forEach(type => {
        let filename = dir + "/" + name + "." + type;
        if  (fileExists(filename)) {
            file.push(",\"__" + type + "__\":");
            file.push(encodeFile(filename));
        }
    });

    file.push("}");

    let ret = file.join("");

    return ret;
}

function getListOfCases(dir) {
    let listFileName = dir + "/list.txt";
    if (!fileExists(listFileName)) {
        return [];
    }

    let list = fs.readFileSync(dir + "/list.txt", "utf8");
    let lines = list.split(/\r?\n/);

    return lines.map(line => line.replace(/#.*$/, ""))
        .filter(line => !line.match(/^\s*$/))
        .map(line => line.split(/\s+/))
        .map(line => [line[0], line.slice(1)]);
}

function fileExists(fileName) {
    return fs.existsSync(fileName) && fs.lstatSync(fileName).isFile();
}

function encodeFile(srcfile) {
    return JSON.stringify(fs.readFileSync(srcfile, "utf8"));
}

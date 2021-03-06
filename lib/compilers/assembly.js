// Copyright (c) 2012-2018, Patrick Quist
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
"use strict";

var Compile = require('../base-compiler'),
    logger = require('../logger').logger,
    AsmRaw = require('../asm-raw').AsmParser,
    utils = require('../utils'),
    fs = require("fs"),
    path = require("path");

function compileAssembly(info, env) {
    var compiler = new Compile(info, env);
    compiler.asm = new AsmRaw();

    compiler.getArgumentParser = () => (compiler) => compiler;

    compiler.optionsForFilter = function (filters, outputFilename, userOptions) {
        filters.binary = true;

        return [];
    };

    compiler.runCompiler = function (compiler, options, inputFilename, execOptions) {
        if (!execOptions) {
            execOptions = this.getDefaultExecOptions();
        }
        execOptions.customCwd = path.dirname(inputFilename);
    
        return this.exec(compiler, options, execOptions).then(function (result) {
            result.inputFilename = inputFilename;
            result.stdout = utils.parseOutput(result.stdout, inputFilename);
            result.stderr = utils.parseOutput(result.stderr, inputFilename);
            return result;
        });
    };

    function getGeneratedOutputfilename(inputFilename) {
        const outputFolder = path.dirname(inputFilename);

        return new Promise((resolve, reject) => {
            fs.readdir(outputFolder, (err, files) => {
                files.forEach(file => {
                    if (file !== compiler.compileFilename) {
                        resolve(path.join(outputFolder, file));
                    }
                });

                reject("No output file was generated");
            });
        });
    }

    compiler.objdump = function (outputFilename, result, maxSize, intelAsm, demangle) {
        return getGeneratedOutputfilename(outputFilename).then((realOutputFilename) => {
            let args = ["-d", realOutputFilename, "-l", "--insn-width=16"];
            if (demangle) args = args.concat("-C");
            if (intelAsm) args = args.concat(["-M", "intel"]);
            return this.exec(this.compiler.objdumper, args, {maxOutput: maxSize})
                .then(function (objResult) {
                    result.asm = objResult.stdout;
                    if (objResult.code !== 0) {
                        result.asm = "<No output: objdump returned " + objResult.code + ">";
                    }
                    return result;
                });
        });
    };

    compiler.getOutputFilename = function (dirPath, outputFilebase) {
        return path.join(dirPath, this.compileFilename);
    };

    if (info.unitTestMode) {
        compiler.initialise();
        return compiler;
    } else
        return compiler.initialise();
}

module.exports = compileAssembly;

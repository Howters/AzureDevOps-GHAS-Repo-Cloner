var exec = require('child_process').exec;

var result = function(command, cb){ // CHANGE THE VALUE OF MAXBUFFER IF ERROR STDOUT
    var child = exec(command, {maxBuffer: 1024 * 800}, function(err, stdout, stderr){
        if(err != null){
    });
}

exports.result = result;
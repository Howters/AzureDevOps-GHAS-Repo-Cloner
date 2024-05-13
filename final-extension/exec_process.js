var exec = require('child_process').exec;

var result = function(command, cb){ // CHANGE THE VALUE OF MAXBUFFER IF ERROR STDOUT
    var child = exec(command, {maxBuffer: 1024 * 800}, function(err, stdout, stderr){
        if(err != null){
            return cb(new Error(err), null);
        }else if(typeof(stderr) != "string"){
            return cb(new Error(stderr), null);
        }else{
            return cb(null, stdout);
        }
    });
}

exports.result = result;
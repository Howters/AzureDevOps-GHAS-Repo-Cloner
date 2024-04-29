"use strict"
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value)
          })
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value))
        } catch (e) {
          reject(e)
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value))
        } catch (e) {
          reject(e)
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected)
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next())
    })
  }


Object.defineProperty(exports, "__esModule", { value: true })
const tl = require("azure-pipelines-task-lib/task")
const axios = require("axios")
const fs = require("fs")
const path = require('path')
const process = require("process")
var osChecking = process.platform
// Check platform (Windows or Linux)
var commandString = 'rm -rf .git'
if (osChecking === "win32") {
  commandString = 'rd /s /q .git'
}

function generateYAML(folderPath) {
  // Read the content of the YAML file
  const yamlBackend = fs.readFileSync('backEndYaml.yaml', 'utf8');
  // Replace the placeholder ${folderPath} with the actual folderPath
  return yamlBackend.replace('${folderPath}', folderPath);
}

function yamlFrontend(){
  // Read the content of the YAML file
  const yamlFrontend = fs.readFileSync('frontEndYaml.yaml', 'utf8');
  // Return the yaml
  return yamlFrontend;
}


function findNugetConfigPath(startDir) {
  const queue = [startDir];
  try{
    while (queue.length > 0) {
        const currentDir = queue.shift();
        const files = fs.readdirSync(currentDir);
          for (const file of files) {
              const filePath = path.join(currentDir, file);
              const stat = fs.statSync(filePath);
              console.log("file path this is:" + filePath);
              if (stat.isDirectory()) {
                  queue.push(filePath);
              } else if (file.toLowerCase() === 'nuget.config') {
                  console.log("file found! , path" + startDir )
                  console.log("Final path :" + filePath.replace(startDir, ''))
                  if (osChecking === "win32") {
                    return filePath.replace(startDir,'').replace(/\//g, '\\');
                } else {
                    return filePath.replace(startDir,'').replace(/\\/g, '/');
                }
              }
          }
      }
      throw "Error : NuGet.config file not found"
    } catch (err) {
      console.log(err);
    }
      return null; 
}

function runPipeline(header,pipelineId){
  var runBody = {
      resources: {
        repositories: {
            self: {
                refName: "refs/heads/master"
            }
        }
    }
  };
    axios
    .post(
      `https://dev.azure.com/{{Org}}/{{Project}}/_apis/pipelines/${pipelineId}/runs?api-version=7.1-preview.1`,
      runBody,
      header
    ).then(function(response){
      console.log("Pipeline Run - Success:");
      console.log(response);
    })
  .catch(function(error){
      console.log("Pipeline Run-Fail:")
      console.log(error);
      tl.setResult(tl.TaskResult.Failed, error);
    })
  }




function run() {
  try {
      const inputString = tl.getInput("projectFolder", true)
      const inputType = tl.getInput("projectType", true)
      // const inputType = "back-end";
      // const inputString = "HEHE-31";
      var execProcess = require("./exec_process.js");
      var cred = 
      "{{Username}}-user:{{PAT}}"
      var conversion = Buffer.from(cred).toString("base64");
      var script, pipelineId;
      var body = {
          name: inputString
      };
      if(inputType == "back-end"){
        var folderPath = findNugetConfigPath(process.cwd());
        folderPath = folderPath.slice(1)
        if(folderPath != null){
          console.log(folderPath);
        }
      }
      let header = {
          headers: {
              "Content-Type": "application/json",
              Authorization: "Basic " + conversion
          }
      };
      axios
      .post(
        "https://dev.azure.com/{{Org}}/{{Project}}/_apis/git/repositories?api-version=7.1-preview.1",
        body,
        header
      )
      // Kalau sukses buat repo
      .then(function (response) {
           //Buat pipeline
        var repoId = response.data.id;
        var pipeBody = {
            folder: inputString,
            name: inputString,
            configuration: {
                type: "yaml",
                path: inputString + ".yaml",
                repository: {
                    id: repoId,
                    name: inputString,
                    type: "azureReposGit"
                }
            }
        };
      axios
      .post(
        "https://dev.azure.com/{{Org}}/{{Project}}/_apis/pipelines?api-version=6.0-preview.1",
          pipeBody,
          header
      )
      .then(function (response) {
        console.log("Pipeline Created with response : ")
        pipelineId = reponse.data.id;
        console.log(response)
      })
      .catch(function (error) {
        if(error.response.status == "409"){
          console.log("Conflict: The pipeline has been made already before. Skipping create pipeline.")
          console.log(error)
        }
        else{
          console.log(error);
          tl.setResult(tl.TaskResult.Failed, error);
        }
      });
      })
      //Kalau fail buat repo
      .catch(function (error) {
        if(error.response.status == "409"){
          console.log("Conflict: The Repo Has Been Made before. Skipping create repo.")
          console.log(error)
        }
        else {
          console.log(error);
          tl.setResult(tl.TaskResult.Failed, error);
        }
      });
          if (inputType == "back-end") { 
            // The project is Back-end
            script = generateYAML(folderPath);
            fs.writeFileSync(inputString + ".yaml", script);

            // Git commands
            execProcess.result(
                commandString +
                ' && echo ".git directory deleted."' +
                ' && git config --global user.email "{{user-email}}"' +
                ' && git config --global user.name "{{Username}}"' +
                ' && git init' +
                ' && git remote add origin https://{{Username}}:{{PAT}}@dev.azure.com/{{Org}}/{{Project}}/_git/' +
                inputString +
                ' && git add .' +
                ' && git commit -m "Initial commit"' +
                ' && git push --force origin master' +
                ' && echo "Git has successfully pushed"',
                function (err, response) {
                    if (!err) {
                        console.log(response);
                        setTimeout(runPipeline(header,pipelineId),2500);
                    } else {
                        console.log(err);
                        tl.setResult(tl.TaskResult.Failed, err);
                    }
                }
            );
        } else { 
          // The project is Front-End
            script = yamlFrontend;
            fs.writeFileSync(inputString + ".yaml", script);

            // Git commands
            execProcess.result(
              commandString +
              ' && echo ".git directory deleted."' +
              ' && git config --global user.email "{{user-email}}"' +
              ' && git config --global user.name "{{Username}}"' +
              ' && git init' +
              ' && git remote add origin https://{{Username}}:{{PAT}}@dev.azure.com/{{Org}}/{{Project}}/_git/' +
              inputString +
              ' && git add .' +
              ' && git commit -m "Initial commit"' +
              ' && git push --force origin master' +
              ' && echo "Git has successfully pushed"',
              function (err, response) {
                  if (!err) {
                      console.log(response);
                      setTimeout(runPipeline(header,pipelineId),2500);
                  } else{
                      console.log(err);
                      tl.setResult(tl.TaskResult.Failed, err);
                  }
              }
          );
        }
  } catch (err) {
      tl.setResult(tl.TaskResult.Failed, err.message);
  }       
}

run();
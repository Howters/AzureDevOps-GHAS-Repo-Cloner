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
console.log("Platform is : " + osChecking)
var commandString = 'rm -rf .git'
if (osChecking === "win32") {
  commandString = 'rd /s /q .git'
}

function yamlBackend(folderPath, projectRepo, emailRecipient, projectOwner, projectRequester, isProd) {
  const yamlBackend = `### Do Not Remove This .yaml File!
trigger:
  branches:
    include:
    - master
pool:
    name: Default
steps:
  - task: HansKhomulia.Hans-SendEmail.custom-build-release-task.HansSendEmail@1
    displayName: 'Hans-Send-Email'
    inputs:
      projectRepo: ${projectRepo}
      recipientEmail: ${emailRecipient}
      projectRequester: ${projectRequester}
      projectOwner: ${projectOwner}
      isProd : ${isProd}`;
  return yamlBackend;
}

function yamlFrontend(projectRepo, emailRecipient, projectOwner, projectRequester, isProd){
  const yamlFrontend =
  //Front-End Yaml
  `### Do Not Remove This .yaml File!
trigger:
  branches:
    include:
    - master
pool:
  name: Azure Pipelines
steps:
  - task: HansKhomulia.Hans-SendEmail.custom-build-release-task.HansSendEmail@1
    displayName: 'Hans-Send-Email'
    inputs:
      projectRepo: ${projectRepo}
      recipientEmail: ${emailRecipient}
      projectRequester: ${projectRequester}
      projectOwner: ${projectOwner}
      isProd : ${isProd}`;

  return yamlFrontend;
}


function findNugetConfigPath(startDir) {
  const queue = [startDir];
  try{
    while (queue.length > 0) {
        const currentDir = queue.shift();
        console.log("Searching for Nuget.config...")
        const files = fs.readdirSync(currentDir);
          for (const file of files) {
              const filePath = path.join(currentDir, file);
              const stat = fs.statSync(filePath);
              console.log("Current File Path :" + filePath);
              if (stat.isDirectory()) {
                  queue.push(filePath);
              } else if (file.toLowerCase() === 'nuget.config') {
                  console.log("Nuget.config Found at path : " + startDir )
                  console.log("Final Path :" + filePath.replace(startDir, ''))
                  if (osChecking === "win32") {
                    console.log("Resulting Path : " + filePath.replace(startDir,'').replace(/\//g, '/'))
                    return filePath.replace(startDir,'').replace(/\//g, '/');
                } else {
                    console.log("Resulting Path : " + filePath.replace(startDir,'').replace(/\\/g, '/'))
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
      `https://dev.azure.com/{{Org}}/{Project}/_apis/pipelines/${pipelineId}/runs?api-version=7.1-preview.1`,
      runBody,
      header
    ).then(function(response){
      console.log("Pipeline Run - Success:");
      console.log(response);
    })
  .catch(function(error){
      console.log("Pipeline Run - Fail:")
      console.log(error);
      tl.setResult(tl.TaskResult.Failed, error);
    })
  }




function run() {
  try {
      const inputString = tl.getInput("projectFolder", true)
      const inputType = tl.getInput("projectType", true)
      const recipientEmail = tl.getInput("recipientEmail", false)
      const projectOwner = tl.getInput("projectOwner", true)
      const projectRequester = tl.getInput("projectRequester", true)
      const isProd = tl.getInput("isProd", true);
      // const inputType = "back-end";
      // const inputString = "HEHE-31";
      var execProcess = require("./exec_process.js");
      var cred = 
      "{{Username}}:{{PAT}}"
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
        "https://dev.azure.com/{{Org}}/{Project}/_apis/git/repositories?api-version=7.1-preview.1",
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
        "https://dev.azure.com/{{Org}}/{Project}/_apis/pipelines?api-version=6.0-preview.1",
          pipeBody,
          header
      )
      .then(function (response) {
        console.log("Pipeline Created with response : ")
        pipelineId = response.data.id;
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
            script = yamlBackend(folderPath, inputString, recipientEmail, projectOwner, projectRequester, isProd);
          }
          else{
            script = yamlFrontend(inputString, recipientEmail, projectOwner, projectRequester, isProd);
          }
          fs.writeFileSync(inputString + ".yaml", script);
          // Git commands
          execProcess.result(
              commandString +
              ' && echo ".git directory deleted."' +
              ' && git config --global user.email "{{email}}"' +
              ' && git config --global user.name "{Name}"' +
              ' && git init' +
              ' && git remote add origin https://{Username}:{{Pat}}@dev.azure.com/hanskhomulia/GHAS-FINAL/_git/' +
              inputString +
              ' && git add .' +
              ' && git commit -m "Initial commit"' +
              ' && git push --force origin master' +
              ' && echo "Git has successfully pushed"',
              function (err, response) {
                  if (!err) {
                      console.log(response);
                      //Run pipeline automatically
                      setTimeout(function() {
                        runPipeline(header, pipelineId);
                    }, 2500);
                  } else {
                      console.log(err);
                      tl.setResult(tl.TaskResult.Failed, err);
                  }
              }
          );
        }
  catch (err) {
      tl.setResult(tl.TaskResult.Failed, err.message);
  }       
}

run();
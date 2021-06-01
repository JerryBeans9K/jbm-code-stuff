from ftplib import FTP
import sys
from zipfile import ZipFile
import os
from os import path
from git import Repo

"""
    command example: python laravel-git-ftp.py production-full zip
"""

ftpServer = "localhost"
ftpUser = "root"
ftpPassword = "password"

scriptDir = os.path.dirname(path.realpath(__file__))

rootDir = scriptDir
repoDir = scriptDir

excludedList = [".git","node_modules",".env",".idea",".log","storage\\","laravel-git-ftp.py",".yml",".lock"]
includedList = ["/vendor","/public"]
requiredDirectories = ["/storage","/storage/framework","/storage/framework/sessions","/storage/framework/views","/storage/framework/cache"]

def ftpMkdir(ftp,dir):
    try:
        ftp.mkd(dir)
    except:
        print("error")

def copyDir():
    pass

def getRepoChangedFiles(baseDir, repo):
    changedFiles = []
    for commit in list(repo.iter_commits()):
        files = commit.stats.files
        for key in files:
            if files[key]["insertions"] > 0  or files[key]["deletions"] > 0: 
                changedFiles.append(baseDir+key)
    return changedFiles

def isInExcludedList(string, excluded):
    result = False
    for ex in excluded:
        if ex in string:
            result = True
            break
    return result

def getDirFiles(dir, excluded):
    files = []
    for folderName, subfolders, filenames in os.walk(dir):
        if isInExcludedList(folderName, excluded) == False:
            for filename in filenames:
                    filePath = os.path.join(folderName, filename)
                    if isInExcludedList(filePath, excluded) == False:
                        files.append(filePath)
    return files

def addFilesToZip(zipObj, files, baseDir):
       for filePath in files:
           zipObj.write(filePath, filePath.replace(baseDir, ""))
           
def connectAndWriteZipToFTP(server, user, password, rootDir):
    ftp = FTP(server)
    ftp.login(user,password)
    file = open(rootDir+"packed.zip","rb")
    ftp.storbinary("STOR packed.zip", file)
    ftp.quit()

def connectAndWriteFilesToFTP(server, user, password, files, baseDir):
    ftp = FTP(server)
    ftp.login(user,password)
    
    for file in files:
        relativeDir = os.path.dirname(file).replace(baseDir, "")
        relativePath = file.replace(baseDir, "")
        fileObj = open(file,"rb")
        if(relativeDir not in [name for name, data in list(ftp.mlsd())]):
            ftpMkdir(ftp, relativeDir)
        ftp.storbinary(f"STOR {relativePath}", fileObj)
    
    ftp.quit()

def connectAndCreateDirectoriesToFTP(server, user, password, dirs):
    ftp = FTP(server)
    ftp.login(user,password)
    for dir in dirs:
        ftpMkdir(ftp, dir)
    ftp.quit()
#exit()
repo = Repo(repoDir)
dirs = None

arguments = sys.argv

if arguments[1] == "all":
    dirs = getDirFiles(repoDir, [])
elif arguments[1] == "non-excluded":
    dirs = getDirFiles(repoDir, excludedList)
elif arguments[1] == "production-full":
    dirs = getDirFiles(repoDir, excludedList)
    for dir in includedList:
        tempFilesList = getDirFiles(dir, [])
        dirs.extend(tempFilesList)
    connectAndCreateDirectoriesToFTP(ftpServer,ftpUser,ftpPassword, requiredDirectories)
elif arguments[1] == "production-changed":
    dirs = getRepoChangedFiles(repoDir, repo)
    for dir in includedList:
        tempFilesList = getDirFiles(dir, [])
        dirs.extend(tempFilesList)
elif arguments[1] == "public-production-changed":
    dirs = getRepoChangedFiles(repoDir, repo)
    tempFilesList = getDirFiles(repoDir+"/public", [])
    dirs.extend(tempFilesList)
elif arguments[1] == "changed":
    dirs = getRepoChangedFiles(repoDir, repo)

zipObj = ZipFile(rootDir+'packed.zip', 'w')
addFilesToZip(zipObj, dirs, repoDir)
zipObj.close()

if arguments[2] == "zip":
    connectAndWriteZipToFTP(ftpServer,ftpUser,ftpPassword, rootDir)
elif arguments[2] == "singles":
    connectAndWriteFilesToFTP(ftpServer,ftpUser,ftpPassword, dirs, repoDir)

os.remove(rootDir+'packed.zip')
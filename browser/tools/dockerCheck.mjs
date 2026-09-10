const { exec } = require("child_process");

exec("docker image inspect electronuserland/builder | grep Id", (error, stdout, stderr) => {
    const out = stdout.trim().toString();
    if (error) {
        console.log(`Could not run docker or find the image. Please install docker and the electronuserland/builder container (docker pull electronuserland/builder).`);
        process.exit(1);
    }
    if (stderr) {
        console.log(`Could not run docker or find the image. Please install docker and the electronuserland/builder container (docker pull electronuserland/builder).`);
        process.exit(1);
    }
    if (out.indexOf("Id")<1) {
        console.log("Please install the electronuserland/builder container into docker: docker pull electronuserland/builder")
        process.exit(1);
    }
    process.exit(0);
})

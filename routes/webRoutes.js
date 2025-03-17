const express = require('express');
const router = express.Router()
// const multer = require('multer');


// const whiteList = [
//     'image/png',
//     'image/jpeg',
//     'image/jpg',
//     'image/webp'
// ]
// const imageMulter = multer({
//     storage: multer.diskStorage({
//         destination: (request, file, callback) => callback(null, "uploads"),
//         filename: (request, file, callback) => callback(null, Date.now() + "_" + file.originalname)
//     }),
//     fileFilter: (request, file, callback) => {
//         if (!whiteList.includes(file.mimetype)) {
//             return callback(new Error('file is not allowed'))
//         }
//         callback(null, true)
//     }
// });

// const imageUploadMiddleware = imageMulter.single('displayPicture');

// router.route('/route')
//     .get(function)
//     .post(middleware, function)
router.route('/')
    .get((req, res) => {
        res.sendFile('index.html', { root: 'public' });
    })
router.route('/*')
    .get((req, res) => {
      res.send('server error');
    })

module.exports = router;
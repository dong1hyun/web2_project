const express = require('express');
const Post = require('../models/post');
const User = require('../models/user');
const Hashtag = require('../models/hashtag');
const Comment = require('../models/comment');

const { isLoggedIn } = require('./helpers');

const router = express.Router();

router.get('/', isLoggedIn, (req, res, next) => {
    res.render('post');
});

router.post('/posting', async (req, res, next) => {
    const { title, content } = req.body;
    const like = 0;

    if (!title) return next('제목을 입력하세요.');
    if (!content) return next('내용을 입력하세요.');

    try {
        const post = await Post.create({
            title,
            content,
            like,
            userId: req.user.id
        });

        const hashtags = req.body.content.match(/#[^\s#]*/g); //정규표현식
        if (hashtags) {
            const result = await Promise.all(
                hashtags.map(tag => { //모델들이 들어간 배열을 만듦
                    return Hashtag.findOrCreate({ //모델에서 입력한 해시태그가 존재하면 찾아서 반환하고, 없으면 새로 만듦
                        where: { hashtag: tag.slice(1).toLowerCase() },
                    })
                }),
            );
            await post.addHashtags(result.map(r => r[0]));
        }

        res.send({
            result: 'success',
            title,
            content,
            error: null
        });
    } catch (err) {
        console.error(err);
        next(err);
    }
})

router.get('/hashtag', async (req, res, next) => {
    const query = req.query.hashtag;
    if (!query) {
        return res.redirect('/');
    }
    try {
        const hashtag = await Hashtag.findOne({ where: { hashtag: query } });
        let posts = [];
        if (hashtag) {
            posts = await hashtag.getPosts({ include: [{ model: User }] });
        }

        res.locals.port = 5000;
        res.locals.posts = posts.map(v => [v?.title, v?.id, v?.User?.nickname]);
        if(posts.length == 0) {
            res.send("해당 해시태그 포스트는 없습니다.");
        }else{
            res.render('hashtagPost');
        }
        
    } catch (error) {
        console.error(error);
        return next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const post = await Post.findOne({
            include: [
                {
                    model: User,
                    attributes: ['nickname', 'id']
                },
            ],
            where: { id: req.params.id }
        });
        const comment = await Comment.findAll({
            include: [
                {
                    model: User,
                    attributes: ['nickname']
                }
            ],
            where: { postId: req.params.id } // 페이지 넘버
        });
        res.locals.authority = req?.user?.id == post?.User?.id; //현재 로그인 돼있는 아이디와 게시글 작성아이디가 같으면 권한이 있음
        res.locals.title = post.title; //게시글 제목
        res.locals.nickname = post.User.nickname //닉네임
        res.locals.content = post.content; //게시글 내용
        res.locals.id = post.id; //게시글 번호
        res.locals.like = post.like;
        res.locals.port = 5000;
        console.log(post.getHashtags);
        res.locals.comments = comment.map(v => [v.comments, v.User.nickname, v.id, req?.user?.id == v.userId]);
        res.render('postContent');
    } catch (err) {
        console.error(err);
        next(err);
    }
});

router.get('/like/:id', isLoggedIn, async (req, res, next) => {
    const post = await Post.findOne({
        attributes: ['like'],
        where: { id: req.params.id }
    });

    let like = post.like + 1;
    try {
        await Post.update({
            like
        }, {
            where: { id: req.params.id }
        }),
        res.redirect(`/post/${req.params.id}`);
    } catch (err) {
        console.error(err);
        next(err);
    }
})

router.post('/update/:id', async (req, res, next) => {
    const { content } = req.body;
    
    if (!content) return next('내용을 입력하세요.');

    try {
        const result = await Post.update({
            content
        }, {
            where: { id: req.params.id }
        });
        if (result) {
            res.send({
                result: 'success',
                content,
                error: null
            });
        }
        else next('Not updated!')
    } catch (err) {
        console.error(err);
        next(err);
    }
});

router.get('/delete/:id', async (req, res, next) => {
    try {
        const result = await Post.destroy({
            where: { id: req.params.id }
        });

        if (result) {
            res.send({
                result: 'success',
                error: null
            });
        }
        else next('Not deleted!')
    } catch (err) {
        console.error(err);
        next(err);
    }
})

module.exports = router;
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_ROOT = path.join(ROOT, 'content', 'projects');
const MANIFEST_PATH = path.join(PROJECTS_ROOT, 'manifest.json');
const PROJECTS_DATA_PATH = path.join(ROOT, 'content', 'projects-data.js');
const PORT = Number(process.env.DTD_CONTENT_PORT || 4173);
const MAX_BODY_SIZE = 300 * 1024 * 1024;

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.mov': 'video/quicktime',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.webp': 'image/webp'
};

function sendJson(response, status, payload) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(payload));
}

function safeRootPath(relativePath) {
    const resolved = path.resolve(ROOT, relativePath);
    if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) {
        throw new Error('Invalid path.');
    }
    return resolved;
}

function safeProjectPath(relativePath) {
    const resolved = safeRootPath(relativePath);
    if (!resolved.startsWith(`${PROJECTS_ROOT}${path.sep}`)) {
        throw new Error('Invalid project path.');
    }
    return resolved;
}

async function readJson(filePath) {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
}

async function writeJsonAtomic(filePath, value) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    await fs.promises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await fs.promises.rename(temporaryPath, filePath);
}

async function writeTextAtomic(filePath, value) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    await fs.promises.writeFile(temporaryPath, value, 'utf8');
    await fs.promises.rename(temporaryPath, filePath);
}

function parseMediaData(dataUrl) {
    const match = /^data:((?:image\/(?:jpeg|png|webp|gif))|(?:video\/(?:mp4|webm|quicktime)));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl || '');
    if (!match) throw new Error('封面支持 JPG、PNG、WEBP、GIF、MP4、WEBM 或 MOV。');
    const extensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov'
    };
    return {
        buffer: Buffer.from(match[2].replace(/\s/g, ''), 'base64'),
        extension: extensions[match[1]],
        mediaType: match[1].startsWith('video/') ? 'video' : 'image'
    };
}

async function saveMedia(projectDirectory, folder, basename, dataUrl) {
    const media = parseMediaData(dataUrl);
    const relativePath = `${folder}/${basename}.${media.extension}`;
    const destination = path.join(projectDirectory, relativePath);
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.writeFile(destination, media.buffer);
    return { relativePath, mediaType: media.mediaType };
}

async function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];

        request.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_SIZE) {
                reject(new Error('上传内容总大小超过 300 MB。'));
                request.destroy();
                return;
            }
            chunks.push(chunk);
        });
        request.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
                reject(new Error('提交内容格式不正确。'));
            }
        });
        request.on('error', reject);
    });
}

async function listProjects() {
    const manifest = await readJson(MANIFEST_PATH);
    const projects = [];

    for (const projectPath of manifest.projects || []) {
        try {
            const project = await readJson(safeProjectPath(projectPath));
            projects.push({ projectPath, project });
        } catch (error) {
            projects.push({ projectPath, error: error.message });
        }
    }

    return projects;
}

async function buildProjectsData() {
    const records = (await listProjects()).filter((record) => record.project);
    const serialized = JSON.stringify(records, null, 2)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    await writeTextAtomic(
        PROJECTS_DATA_PATH,
        `// 此文件由本地内容面板自动生成，请不要手动编辑。\nwindow.DTD_PROJECTS = ${serialized};\n`
    );
}

function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

async function saveProject(payload) {
    const section = payload.section === 'pay' ? 'pay' : 'play';
    const slug = cleanText(payload.slug).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('英文短名只能使用小写字母、数字和短横线。');
    }
    if (!cleanText(payload.title)) throw new Error('请填写项目名称。');

    const newProjectPath = `content/projects/${section}/${slug}/project.json`;
    const originalPath = cleanText(payload.originalPath);
    if (originalPath && originalPath !== newProjectPath) {
        throw new Error('编辑已有项目时不能修改分类或英文短名。请新建项目。');
    }

    const projectPath = originalPath || newProjectPath;
    const absoluteProjectPath = safeProjectPath(projectPath);
    const projectDirectory = path.dirname(absoluteProjectPath);
    await fs.promises.mkdir(projectDirectory, { recursive: true });

    let coverSrc = cleanText(payload.cover?.src);
    let coverMediaType = payload.cover?.mediaType === 'video' ? 'video' : 'image';
    if (payload.cover?.dataUrl) {
        const savedCover = await saveMedia(projectDirectory, 'cover', 'cover', payload.cover.dataUrl);
        coverSrc = savedCover.relativePath;
        coverMediaType = savedCover.mediaType;
    }

    const gallery = [];
    for (let index = 0; index < (payload.images || []).length; index += 1) {
        const item = payload.images[index] || {};
        let imageSrc = cleanText(item.src);
        let imageMediaType = item.mediaType === 'video' || /\.(mp4|webm|mov)$/i.test(imageSrc)
            ? 'video'
            : 'image';
        if (item.dataUrl) {
            const savedImage = await saveMedia(
                projectDirectory,
                'images',
                String(index + 1).padStart(2, '0'),
                item.dataUrl
            );
            imageSrc = savedImage.relativePath;
            imageMediaType = savedImage.mediaType;
        }
        if (!imageSrc) continue;
        gallery.push({
            src: imageSrc,
            mediaType: imageMediaType,
            alt: cleanText(item.alt),
            fit: item.fit === 'cover' ? 'cover' : 'contain',
            background: cleanText(item.background) || '#ffffff',
            caption: cleanText(
                typeof item.caption === 'string'
                    ? item.caption
                    : item.caption?.zh || item.caption?.en
            )
        });
    }

    const project = {
        published: payload.published !== false,
        section,
        order: Number.isFinite(Number(payload.order)) ? Number(payload.order) : 10,
        slug,
        title: cleanText(payload.title),
        subtitle: cleanText(payload.subtitle),
        tag: cleanText(payload.tag),
        year: cleanText(payload.year),
        approaches: Array.isArray(payload.approaches)
            ? payload.approaches.filter((value) => ['interaction', 'book', 'graphic'].includes(value))
            : [],
        cover: {
            src: coverSrc,
            mediaType: coverMediaType,
            alt: cleanText(payload.cover?.alt),
            fit: payload.cover?.fit === 'cover' ? 'cover' : 'contain',
            background: cleanText(payload.cover?.background) || '#f2f2f2'
        },
        intro: {
            zh: cleanText(payload.intro?.zh),
            en: cleanText(payload.intro?.en)
        },
        details: {
            client: cleanText(payload.details?.client),
            role: cleanText(payload.details?.role),
            team: cleanText(payload.details?.team)
        },
        images: gallery
    };

    await writeJsonAtomic(absoluteProjectPath, project);

    const manifest = await readJson(MANIFEST_PATH);
    if (!manifest.projects.includes(projectPath)) manifest.projects.push(projectPath);
    await writeJsonAtomic(MANIFEST_PATH, manifest);
    await buildProjectsData();

    return { projectPath, project };
}

async function translateText(payload) {
    const text = cleanText(payload.text);
    if (!text) return { translatedText: '' };
    if (text.length > 12000) throw new Error('单次翻译内容不能超过 12,000 个字符。');

    const source = payload.source === 'zh-CN' ? 'zh-CN' : 'en';
    const target = payload.target === 'zh-CN' ? 'zh-CN' : 'en';
    if (source === target) return { translatedText: text };

    const chunks = [];
    let current = '';
    for (const character of text) {
        if (Buffer.byteLength(current + character, 'utf8') > 450 && current) {
            chunks.push(current);
            current = character;
        } else {
            current += character;
        }
    }
    if (current) chunks.push(current);

    const translatedChunks = [];
    for (const chunk of chunks) {
        const endpoint = new URL('https://api.mymemory.translated.net/get');
        endpoint.searchParams.set('q', chunk);
        endpoint.searchParams.set('langpair', `${source}|${target}`);
        endpoint.searchParams.set('mt', '1');
        const response = await fetch(endpoint, {
            headers: { 'User-Agent': 'day-to-day-local-content-panel/1.0' }
        });
        if (!response.ok) throw new Error('自动翻译暂时不可用。');
        const result = await response.json();
        if (result.responseStatus !== 200 || !result.responseData?.translatedText) {
            throw new Error(result.responseDetails || '没有收到翻译结果。');
        }
        translatedChunks.push(result.responseData.translatedText);
    }

    const translatedText = translatedChunks.join('').trim();
    if (!translatedText) throw new Error('没有收到翻译结果。');
    return { translatedText };
}

async function handleApi(request, response, pathname) {
    if (request.method === 'GET' && pathname === '/api/projects') {
        sendJson(response, 200, { projects: await listProjects() });
        return true;
    }

    if (request.method === 'POST' && pathname === '/api/projects') {
        const payload = await readRequestBody(request);
        sendJson(response, 200, await saveProject(payload));
        return true;
    }

    if (request.method === 'POST' && pathname === '/api/translate') {
        const payload = await readRequestBody(request);
        sendJson(response, 200, await translateText(payload));
        return true;
    }

    return false;
}

async function serveStatic(response, pathname) {
    const requestedPath = pathname === '/' ? '/index.html' : pathname === '/admin' ? '/admin.html' : pathname;
    let filePath;
    try {
        filePath = safeRootPath(decodeURIComponent(requestedPath.replace(/^\//, '')));
    } catch {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }

    try {
        const stats = await fs.promises.stat(filePath);
        if (stats.isDirectory()) filePath = path.join(filePath, 'index.html');
        const contents = await fs.promises.readFile(filePath);
        response.writeHead(200, {
            'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        response.end(contents);
    } catch {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
    }
}

const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`).pathname;
    try {
        if (pathname.startsWith('/api/') && await handleApi(request, response, pathname)) return;
        await serveStatic(response, pathname);
    } catch (error) {
        sendJson(response, 400, { error: error.message || '保存失败。' });
    }
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`端口 ${PORT} 已被使用。内容面板可能已经打开。`);
    } else {
        console.error(error.message);
    }
    process.exit(1);
});

buildProjectsData()
    .then(() => {
        server.listen(PORT, '127.0.0.1', () => {
            console.log(`day.To.day 内容面板：http://127.0.0.1:${PORT}/admin.html`);
            console.log('按 Control + C 停止。');
        });
    })
    .catch((error) => {
        console.error(`无法生成网站内容：${error.message}`);
        process.exit(1);
    });

const form = document.getElementById('project-form');
const picker = document.getElementById('project-picker');
const statusLine = document.getElementById('save-status');
const saveButton = document.getElementById('save-project');
const galleryEditor = document.getElementById('gallery-editor');
const galleryTemplate = document.getElementById('gallery-item-template');
const autoTranslate = document.getElementById('auto-translate');
const translationStatus = document.getElementById('translation-status');

const fields = {
    section: document.getElementById('section'),
    slug: document.getElementById('slug'),
    order: document.getElementById('order'),
    year: document.getElementById('year'),
    title: document.getElementById('title'),
    subtitle: document.getElementById('subtitle'),
    tag: document.getElementById('tag'),
    coverFile: document.getElementById('cover-file'),
    coverFit: document.getElementById('cover-fit'),
    coverBackground: document.getElementById('cover-background'),
    coverAlt: document.getElementById('cover-alt'),
    introZh: document.getElementById('intro-zh'),
    introEn: document.getElementById('intro-en'),
    client: document.getElementById('client'),
    role: document.getElementById('role'),
    team: document.getElementById('team'),
    published: document.getElementById('published')
};

const preview = {
    section: document.getElementById('preview-section'),
    coverMedia: document.getElementById('preview-cover-media'),
    coverImage: document.getElementById('preview-cover-image'),
    coverVideo: document.getElementById('preview-cover-video'),
    coverEmpty: document.getElementById('preview-cover-empty'),
    title: document.getElementById('preview-title'),
    subtitle: document.getElementById('preview-subtitle'),
    detailTitle: document.getElementById('detail-title'),
    detailSubtitle: document.getElementById('detail-subtitle'),
    detailYear: document.getElementById('detail-year'),
    introZh: document.getElementById('detail-intro-zh'),
    introEn: document.getElementById('detail-intro-en'),
    gallery: document.getElementById('gallery-preview')
};

let projectRecords = [];
let originalPath = '';
let coverState = { src: '', previewUrl: '', file: null, mediaType: 'image' };
let galleryState = [];

function projectAssetUrl(projectPath, assetPath) {
    if (!projectPath || !assetPath) return '';
    return new URL(assetPath, new URL(`/${projectPath}`, window.location.origin)).href;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`无法读取媒体文件：${file.name}`));
        reader.readAsDataURL(file);
    });
}

async function requestTranslation(text, source, target) {
    const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source, target })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '翻译失败。');
    return result.translatedText;
}

async function completeMissingIntroduction() {
    if (!autoTranslate.checked) return;

    const zh = fields.introZh.value.trim();
    const en = fields.introEn.value.trim();
    if ((!zh && !en) || (zh && en)) return;

    translationStatus.textContent = '正在补全项目简介翻译…';
    if (!zh) {
        fields.introZh.value = await requestTranslation(en, 'en', 'zh-CN');
    } else {
        fields.introEn.value = await requestTranslation(zh, 'zh-CN', 'en');
    }
    translationStatus.textContent = '已自动补全中英文';
    updatePreview();
}

function bindTranslationPair(zhInput, enInput, afterTranslate = updatePreview) {
    let zhTimer = 0;
    let enTimer = 0;
    let requestVersion = 0;

    const queue = (sourceInput, targetInput, source, target, timerName) => {
        clearTimeout(zhTimer);
        clearTimeout(enTimer);
        if (!autoTranslate.checked || !sourceInput.value.trim()) return;

        const run = async () => {
            const sourceText = sourceInput.value.trim();
            const version = ++requestVersion;
            translationStatus.textContent = '翻译中…';
            try {
                const translatedText = await requestTranslation(sourceText, source, target);
                if (version !== requestVersion || sourceInput.value.trim() !== sourceText) return;
                targetInput.value = translatedText;
                translationStatus.textContent = '已自动翻译';
                afterTranslate();
            } catch (error) {
                translationStatus.textContent = error.message || '翻译暂时不可用';
            }
        };

        if (timerName === 'zh') zhTimer = setTimeout(run, 850);
        if (timerName === 'en') enTimer = setTimeout(run, 850);
    };

    zhInput.addEventListener('input', () => queue(zhInput, enInput, 'zh-CN', 'en', 'zh'));
    enInput.addEventListener('input', () => queue(enInput, zhInput, 'en', 'zh-CN', 'en'));
}

function setStatus(message = '', type = '') {
    statusLine.textContent = message;
    statusLine.className = `save-status${type ? ` is-${type}` : ''}`;
}

function selectedApproaches() {
    return [...document.querySelectorAll('input[name="approach"]:checked')].map((input) => input.value);
}

function setApproaches(values = []) {
    document.querySelectorAll('input[name="approach"]').forEach((input) => {
        input.checked = values.includes(input.value);
    });
}

function setCoverPreview(url, mediaType) {
    const isVideo = Boolean(url) && mediaType === 'video';
    const isImage = Boolean(url) && !isVideo;
    preview.coverImage.hidden = !isImage;
    preview.coverVideo.hidden = !isVideo;
    preview.coverEmpty.hidden = Boolean(url);
    if (isImage) preview.coverImage.src = url;
    if (isVideo) {
        preview.coverVideo.src = url;
        preview.coverVideo.play().catch(() => {});
    } else {
        preview.coverVideo.pause();
        preview.coverVideo.removeAttribute('src');
    }
}

function updatePreview() {
    preview.section.textContent = fields.section.value.toUpperCase();
    preview.title.textContent = fields.title.value || '项目名称';
    preview.subtitle.textContent = fields.subtitle.value || 'Project subtitle';
    preview.detailTitle.textContent = fields.title.value || '项目名称';
    preview.detailSubtitle.textContent = fields.tag.value || fields.subtitle.value || 'Graphic / Exhibition';
    preview.detailYear.textContent = fields.year.value || '年份';
    preview.introZh.textContent = fields.introZh.value || '中文简介会显示在这里。';
    preview.introEn.textContent = fields.introEn.value || 'The English introduction appears here.';
    preview.coverMedia.style.background = fields.coverBackground.value;
    preview.coverImage.style.objectFit = fields.coverFit.value;
    preview.coverVideo.style.objectFit = fields.coverFit.value;
    preview.coverImage.alt = fields.coverAlt.value;
    preview.coverVideo.setAttribute('aria-label', fields.coverAlt.value);
    setCoverPreview(coverState.previewUrl, coverState.mediaType);
    renderGalleryPreview();
}

function renderGalleryPreview() {
    preview.gallery.replaceChildren();
    galleryState.forEach((item, index) => {
        const figure = document.createElement('figure');
        figure.className = 'gallery-preview__item';

        const media = document.createElement('div');
        media.className = 'gallery-preview__media';
        media.style.background = item.background || '#ffffff';

        if (item.previewUrl) {
            if (item.mediaType === 'video') {
                const video = document.createElement('video');
                video.src = item.previewUrl;
                video.muted = true;
                video.loop = true;
                video.autoplay = true;
                video.playsInline = true;
                video.controls = true;
                video.style.objectFit = item.fit || 'contain';
                video.setAttribute('aria-label', item.alt || '');
                media.appendChild(video);
            } else {
                const image = document.createElement('img');
                image.src = item.previewUrl;
                image.alt = item.alt || '';
                image.style.objectFit = item.fit || 'contain';
                media.appendChild(image);
            }
        } else {
            media.textContent = `详情媒体 ${String(index + 1).padStart(2, '0')}`;
        }

        const caption = document.createElement('figcaption');
        caption.className = 'gallery-preview__caption';
        caption.textContent = item.caption || '媒体注释';
        figure.append(media, caption);
        preview.gallery.appendChild(figure);
    });
}

function syncGalleryItem(index, element) {
    const item = galleryState[index];
    item.alt = element.querySelector('.gallery-alt').value;
    item.caption = element.querySelector('.gallery-caption').value;
    item.fit = element.querySelector('.gallery-fit').value;
    item.background = element.querySelector('.gallery-background').value;
}

function renderGalleryEditor() {
    galleryEditor.replaceChildren();
    if (!galleryState.length) {
        const empty = document.createElement('p');
        empty.className = 'gallery-empty';
        empty.textContent = '还没有详情媒体。点击“添加图片”开始。';
        galleryEditor.appendChild(empty);
        renderGalleryPreview();
        return;
    }

    galleryState.forEach((item, index) => {
        const element = galleryTemplate.content.firstElementChild.cloneNode(true);
        element.querySelector('.gallery-item__number').textContent = `媒体 ${String(index + 1).padStart(2, '0')}`;
        element.querySelector('.gallery-current').textContent = item.src
            ? `当前文件：${item.src}`
            : item.file
                ? `已选择：${item.file.name}`
                : '尚未选择图片、GIF 或视频。';
        element.querySelector('.gallery-alt').value = item.alt || '';
        element.querySelector('.gallery-caption').value = item.caption || '';
        element.querySelector('.gallery-fit').value = item.fit || 'contain';
        element.querySelector('.gallery-background').value = item.background || '#ffffff';

        element.querySelector('.gallery-file').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            item.file = file;
            item.previewUrl = URL.createObjectURL(file);
            item.mediaType = file.type.startsWith('video/') ? 'video' : 'image';
            element.querySelector('.gallery-current').textContent = `已选择：${file.name}`;
            renderGalleryPreview();
        });

        element.querySelector('.gallery-item__remove').addEventListener('click', () => {
            galleryState.splice(index, 1);
            renderGalleryEditor();
        });

        element.querySelectorAll('input[type="text"], textarea, select, input[type="color"]').forEach((input) => {
            input.addEventListener('input', () => {
                syncGalleryItem(index, element);
                renderGalleryPreview();
            });
            input.addEventListener('change', () => {
                syncGalleryItem(index, element);
                renderGalleryPreview();
            });
        });

        galleryEditor.appendChild(element);
    });
    renderGalleryPreview();
}

function resetForm() {
    originalPath = '';
    form.reset();
    fields.section.value = 'play';
    fields.order.value = '10';
    fields.coverFit.value = 'contain';
    fields.coverBackground.value = '#f2f2f2';
    fields.published.checked = true;
    fields.section.disabled = false;
    fields.slug.disabled = false;
    picker.value = '';
    coverState = { src: '', previewUrl: '', file: null, mediaType: 'image' };
    galleryState = [];
    document.getElementById('cover-current').textContent = '尚未选择图片或视频；正方形位置仍会保留。';
    setApproaches([]);
    translationStatus.textContent = '';
    setStatus('');
    renderGalleryEditor();
    updatePreview();
}

function loadProject(record) {
    const { project, projectPath } = record;
    originalPath = projectPath;
    fields.section.value = project.section || 'play';
    fields.slug.value = project.slug || '';
    fields.order.value = project.order ?? 10;
    fields.year.value = project.year || '';
    fields.title.value = project.title || '';
    fields.subtitle.value = project.subtitle || '';
    fields.tag.value = project.tag || '';
    fields.coverFit.value = project.cover?.fit || 'contain';
    fields.coverBackground.value = project.cover?.background || '#f2f2f2';
    fields.coverAlt.value = project.cover?.alt || '';
    fields.introZh.value = project.intro?.zh || '';
    fields.introEn.value = project.intro?.en || '';
    fields.client.value = project.details?.client || '';
    fields.role.value = project.details?.role || '';
    fields.team.value = project.details?.team || '';
    fields.published.checked = project.published !== false;
    fields.section.disabled = true;
    fields.slug.disabled = true;
    setApproaches(project.approaches || []);
    translationStatus.textContent = '';

    coverState = {
        src: project.cover?.src || '',
        previewUrl: projectAssetUrl(projectPath, project.cover?.src),
        file: null,
        mediaType: project.cover?.mediaType === 'video' || /\.(mp4|webm|mov)$/i.test(project.cover?.src || '')
            ? 'video'
            : 'image'
    };
    document.getElementById('cover-current').textContent = coverState.src
        ? `当前文件：${coverState.src}`
        : '尚未选择图片或视频；正方形位置仍会保留。';

    galleryState = (project.images || []).map((item) => ({
        src: item.src || '',
        previewUrl: projectAssetUrl(projectPath, item.src),
        file: null,
        mediaType: item.mediaType === 'video' || /\.(mp4|webm|mov)$/i.test(item.src || '') ? 'video' : 'image',
        alt: item.alt || '',
        fit: item.fit || 'contain',
        background: item.background || '#ffffff',
        caption: typeof item.caption === 'string'
            ? item.caption
            : item.caption?.zh || item.caption?.en || ''
    }));

    setStatus('');
    renderGalleryEditor();
    updatePreview();

    if (autoTranslate.checked) {
        if (!fields.introZh.value.trim() && fields.introEn.value.trim()) {
            fields.introEn.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (!fields.introEn.value.trim() && fields.introZh.value.trim()) {
            fields.introZh.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}

async function refreshProjects(selectPath = '') {
    const response = await fetch('/api/projects');
    if (!response.ok) throw new Error('无法读取项目列表。');
    const data = await response.json();
    projectRecords = data.projects.filter((record) => record.project);

    picker.replaceChildren(new Option('＋ 新建项目', ''));
    projectRecords.forEach((record) => {
        const label = `${record.project.section.toUpperCase()} · ${record.project.title || record.project.slug}`;
        picker.add(new Option(label, record.projectPath));
    });

    if (selectPath) {
        picker.value = selectPath;
        const record = projectRecords.find((item) => item.projectPath === selectPath);
        if (record) loadProject(record);
    }
}

fields.coverFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    coverState.file = file;
    coverState.previewUrl = URL.createObjectURL(file);
    coverState.mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    document.getElementById('cover-current').textContent = `已选择：${file.name}`;
    updatePreview();
});

form.querySelectorAll('input, textarea, select').forEach((input) => {
    input.addEventListener('input', updatePreview);
    input.addEventListener('change', updatePreview);
});

bindTranslationPair(fields.introZh, fields.introEn);

picker.addEventListener('change', () => {
    if (!picker.value) {
        resetForm();
        return;
    }
    const record = projectRecords.find((item) => item.projectPath === picker.value);
    if (record) loadProject(record);
});

document.getElementById('new-project').addEventListener('click', resetForm);

document.getElementById('add-image').addEventListener('click', () => {
    galleryState.push({
        src: '',
        previewUrl: '',
        file: null,
        mediaType: 'image',
        alt: '',
        caption: '',
        fit: 'contain',
        background: '#ffffff'
    });
    renderGalleryEditor();
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    saveButton.disabled = true;
    setStatus('正在保存图片和文字……');

    try {
        await completeMissingIntroduction();

        const images = await Promise.all(galleryState.map(async (item) => ({
            src: item.src,
            dataUrl: item.file ? await fileToDataUrl(item.file) : '',
            mediaType: item.mediaType,
            alt: item.alt,
            fit: item.fit,
            background: item.background,
            caption: item.caption
        })));

        const payload = {
            originalPath,
            section: fields.section.value,
            slug: fields.slug.value,
            order: fields.order.value,
            year: fields.year.value,
            title: fields.title.value,
            subtitle: fields.subtitle.value,
            tag: fields.tag.value,
            published: fields.published.checked,
            approaches: selectedApproaches(),
            cover: {
                src: coverState.src,
                dataUrl: coverState.file ? await fileToDataUrl(coverState.file) : '',
                mediaType: coverState.mediaType,
                alt: fields.coverAlt.value,
                fit: fields.coverFit.value,
                background: fields.coverBackground.value
            },
            intro: { zh: fields.introZh.value, en: fields.introEn.value },
            details: {
                client: fields.client.value,
                role: fields.role.value,
                team: fields.team.value
            },
            images
        };

        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '保存失败。');

        setStatus('已保存。index.html 和项目详情页已经同步。', 'success');
        await refreshProjects(result.projectPath);
        setStatus('已保存。index.html 和项目详情页已经同步。', 'success');
    } catch (error) {
        setStatus(error.message || '保存失败，请重试。', 'error');
    } finally {
        saveButton.disabled = false;
    }
});

refreshProjects()
    .then(resetForm)
    .catch((error) => setStatus(error.message, 'error'));

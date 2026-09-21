(function renderProjectDetail() {
    const params = new URLSearchParams(window.location.search);
    const projectPath = params.get('project');
    const content = document.getElementById('project-content');
    const error = document.getElementById('project-error');

    const resolveAsset = (assetPath) => {
        if (!assetPath) return '';
        return new URL(assetPath, new URL(projectPath, window.location.href)).href;
    };

    const addDetail = (list, label, value) => {
        if (!value) return;
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        list.append(term, description);
    };

    const createMedia = (item, options = {}) => {
        const isVideo = item.mediaType === 'video' || /\.(mp4|webm|mov)$/i.test(item.src || '');
        if (isVideo) {
            const video = document.createElement('video');
            video.src = resolveAsset(item.src);
            video.muted = true;
            video.loop = true;
            video.autoplay = true;
            video.playsInline = true;
            video.controls = options.controls === true;
            video.preload = 'metadata';
            video.setAttribute('aria-label', item.alt || '');
            return video;
        }

        const image = document.createElement('img');
        image.src = resolveAsset(item.src);
        image.alt = item.alt || '';
        image.loading = options.eager ? 'eager' : 'lazy';
        return image;
    };

    try {
        if (!projectPath || !projectPath.startsWith('content/projects/')) {
            throw new Error('Invalid project path.');
        }

        const record = (window.DTD_PROJECTS || []).find((item) => item.projectPath === projectPath);
        if (!record) throw new Error('Project could not be loaded.');
        const project = record.project;
        const approachLabels = {
            interaction: 'Interaction',
            book: 'Book',
            graphic: 'Graphic'
        };

        document.title = `${project.title || 'Project'} — day.To.day`;
        document.body.dataset.section = project.section === 'play' ? 'play' : 'pay';
        document.getElementById('project-title').textContent = project.title || '';
        document.getElementById('project-subtitle').textContent = project.tag
            || project.subtitle
            || (project.approaches || []).map((item) => approachLabels[item] || item).join(' / ');
        document.getElementById('project-year').textContent = project.year || '';
        document.getElementById('project-intro-zh').textContent = project.intro?.zh || '';
        document.getElementById('project-intro-en').textContent = project.intro?.en || '';

        if (project.cover?.src) {
            const hero = document.getElementById('project-hero');
            hero.appendChild(createMedia(project.cover, { eager: true }));
            hero.hidden = false;
        }

        const details = document.getElementById('project-details');
        addDetail(details, 'Client', project.details?.client);
        addDetail(details, 'Role', project.details?.role);
        addDetail(details, 'Team', project.details?.team);

        const gallery = document.getElementById('project-gallery');
        (project.images || []).forEach((item) => {
            if (!item.src) return;
            const figure = document.createElement('figure');
            figure.className = 'project-figure';

            const media = document.createElement('div');
            media.className = 'project-figure__media';

            media.appendChild(createMedia(item, { controls: true }));

            const caption = document.createElement('figcaption');
            caption.textContent = typeof item.caption === 'string'
                ? item.caption
                : item.caption?.zh || item.caption?.en || '';

            figure.appendChild(media);
            if (caption.textContent) figure.appendChild(caption);
            gallery.appendChild(figure);
        });

        content.hidden = false;
    } catch (cause) {
        console.error(cause);
        error.hidden = false;
    }
})();

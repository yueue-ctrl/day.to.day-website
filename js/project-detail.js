(async function renderProjectDetail() {
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

    try {
        if (!projectPath || !projectPath.startsWith('content/projects/')) {
            throw new Error('Invalid project path.');
        }

        const response = await fetch(projectPath);
        if (!response.ok) throw new Error('Project could not be loaded.');
        const project = await response.json();

        document.title = `${project.title || 'Project'} — day.To.day`;
        document.getElementById('project-title').textContent = project.title || '';
        document.getElementById('project-subtitle').textContent = project.subtitle || '';
        document.getElementById('project-year').textContent = project.year || '';
        document.getElementById('project-intro-zh').textContent = project.intro?.zh || '';
        document.getElementById('project-intro-en').textContent = project.intro?.en || '';

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
            media.style.setProperty('--image-bg', item.background || '#fff');
            media.style.setProperty('--image-fit', item.fit || 'contain');

            const image = document.createElement('img');
            image.src = resolveAsset(item.src);
            image.alt = item.alt || '';
            image.loading = 'lazy';
            media.appendChild(image);

            const caption = document.createElement('figcaption');
            const zh = document.createElement('span');
            zh.textContent = item.caption?.zh || '';
            const en = document.createElement('span');
            en.textContent = item.caption?.en || '';
            caption.append(zh, en);

            figure.append(media, caption);
            gallery.appendChild(figure);
        });

        content.hidden = false;
    } catch (cause) {
        console.error(cause);
        error.hidden = false;
    }
})();

(async function renderProjectGrid() {
    const containers = {
        play: document.getElementById('play-projects'),
        pay: document.getElementById('pay-projects')
    };

    const resolveAsset = (projectPath, assetPath) => {
        if (!assetPath) return '';
        return new URL(assetPath, new URL(projectPath, window.location.href)).href;
    };

    const createCard = (project, projectPath) => {
        const card = document.createElement('a');
        card.className = 'project-card';
        card.href = `project.html?project=${encodeURIComponent(projectPath)}`;

        const media = document.createElement('div');
        media.className = 'project-card__media';
        media.style.setProperty('--project-bg', project.cover?.background || '#f2f2f2');
        media.style.setProperty('--project-fit', project.cover?.fit || 'contain');

        if (project.cover?.src) {
            const image = document.createElement('img');
            image.src = resolveAsset(projectPath, project.cover.src);
            image.alt = project.cover.alt || '';
            image.loading = 'lazy';
            media.appendChild(image);
        } else {
            media.classList.add('project-card__media--empty');
            media.setAttribute('aria-label', 'Preview image to be added');
        }

        const meta = document.createElement('div');
        meta.className = 'project-card__meta';

        const title = document.createElement('span');
        title.className = 'project-card__title';
        title.textContent = project.title || 'Untitled';

        const subtitle = document.createElement('span');
        subtitle.className = 'project-card__subtitle';
        subtitle.textContent = project.subtitle || '';

        meta.append(title, subtitle);
        card.append(media, meta);
        return card;
    };

    try {
        const manifestResponse = await fetch('content/projects/manifest.json');
        if (!manifestResponse.ok) throw new Error('Project manifest could not be loaded.');
        const manifest = await manifestResponse.json();

        const records = await Promise.all((manifest.projects || []).map(async (projectPath) => {
            const response = await fetch(projectPath);
            if (!response.ok) throw new Error(`Project could not be loaded: ${projectPath}`);
            return { project: await response.json(), projectPath };
        }));

        records
            .filter(({ project }) => project.published !== false && containers[project.section])
            .sort((a, b) => (a.project.order ?? 999) - (b.project.order ?? 999))
            .forEach(({ project, projectPath }) => {
                containers[project.section].appendChild(createCard(project, projectPath));
            });
    } catch (error) {
        console.error(error);
    }
})();

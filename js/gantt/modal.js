// js/gantt/modal.js
export class Modal {
    constructor(title, formElement, onSave) {
        this.title = title;
        this.formElement = formElement;
        this.onSave = onSave;
        this.create();
    }

    create() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        const container = document.createElement('div');
        container.className = 'modal-container';

        // Create header using DOM API
        const header = document.createElement('div');
        header.className = 'modal-header';

        const headerTitle = document.createElement('h2');
        headerTitle.textContent = this.title;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close-btn';
        closeBtn.innerHTML = '&times;';

        header.appendChild(headerTitle);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.className = 'modal-content';
        content.appendChild(this.formElement);
        this.form = content;

        // Create footer using DOM API
        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'modal-cancel-btn';
        cancelBtn.textContent = 'Cancel';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'modal-save-btn';
        saveBtn.textContent = 'Save';

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        container.append(header, content, footer);
        this.overlay.appendChild(container);

        closeBtn.addEventListener('click', () => this.hide());
        cancelBtn.addEventListener('click', () => this.hide());
        saveBtn.addEventListener('click', () => this.handleSave());
    }

    handleSave() {
        const data = {};
        this.form.querySelectorAll('input, select').forEach(input => {
            if (input.type === 'select-multiple') {
                data[input.name] = Array.from(input.selectedOptions).map(option => option.value);
            } else {
                data[input.name] = input.value;
            }
        });
        if (this.onSave(data)) this.hide();
    }

    show(mountElement = document.body) {
        this.mountElement = mountElement;
        this.mountElement.appendChild(this.overlay);
    }

    hide() { this.mountElement.removeChild(this.overlay); }
}

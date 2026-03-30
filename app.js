// === LOADER ===
window.addEventListener('load', () => {
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 2000);
});

// === HEADER SCROLL ===
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
});

// === MOBILE MENU ===
const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('nav');
menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('active');
    nav.classList.toggle('open');
});
nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        nav.classList.remove('open');
    });
});

// === ACTIVE NAV ON SCROLL ===
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY + 100;
    sections.forEach(section => {
        const top = section.offsetTop - 100;
        const bottom = top + section.offsetHeight;
        const id = section.getAttribute('id');
        const link = document.querySelector(`.nav-link[href="#${id}"]`);
        if (link) {
            link.classList.toggle('active', scrollY >= top && scrollY < bottom);
        }
    });
});

// === BACK TO TOP ===
const backToTop = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
    backToTop.classList.toggle('visible', window.scrollY > 500);
});
backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// === FLOOR PLAN TABS ===
document.querySelectorAll('.fp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.fp-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.fp-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`[data-panel="${tab.dataset.fp}"]`).classList.add('active');
    });
});

// === SCROLL REVEAL ===
const revealElements = document.querySelectorAll('.section-header, .residence-card, .amenity-card, .gallery-item, .contact-info, .contact-form, .invest-banner, .feature-item, .intro-content, .intro-img-box');
revealElements.forEach(el => el.classList.add('reveal'));

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

revealElements.forEach(el => observer.observe(el));

// === CONTACT FORM ===
document.getElementById('contactForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const firstName = form.querySelector('#firstName').value;
    const lastName = form.querySelector('#lastName').value;
    const email = form.querySelector('#email').value;
    const phone = form.querySelector('#phone').value;
    const interest = form.querySelector('#interest').value;
    const budget = form.querySelector('#budget').value;
    const message = form.querySelector('#message').value;

    const subject = encodeURIComponent(`W Residences Inquiry from ${firstName} ${lastName}`);
    const body = encodeURIComponent(
        `New inquiry from W Residences Pompano Beach website:\n\n` +
        `Name: ${firstName} ${lastName}\n` +
        `Email: ${email}\n` +
        `Phone: ${phone}\n` +
        `Interest: ${interest}\n` +
        `Budget: ${budget}\n` +
        `Message: ${message}\n`
    );

    window.location.href = `mailto:andrea.patnik@compass.com?subject=${subject}&body=${body}`;

    // Show success
    form.innerHTML = `
        <div class="form-success show">
            <h3>Thank You!</h3>
            <p>Your email client should open momentarily. If it doesn't, please email Andrea directly at <a href="mailto:andrea.patnik@compass.com" style="color:#b08d57">andrea.patnik@compass.com</a> or call <a href="tel:9546472394" style="color:#b08d57">(954) 647-2394</a>.</p>
        </div>
    `;
});

// === SMOOTH SCROLL FOR ALL ANCHOR LINKS ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

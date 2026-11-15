import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, CalendarDays, Maximize2, MessagesSquare } from "lucide-react";
import video from "../../assets/Assistly_Business_Demo_Branded.mp4";
import appointments from "../../assets/appointments.png";
import conversations from "../../assets/conversations.png";
import team from "../../assets/doctors.png";
import knowledge from "../../assets/faqs.png";
import leads from "../../assets/leads.png";
import services from "../../assets/services.png";
import "./demo.css";

const examples = [
  { title: "Conversations", image: conversations, alt: "Customer inbox with a conversation open and a Pause for staff button", caption: "Read the conversation so far, see whether AI replies are active, and pause the assistant when staff need to step in." },
  { title: "Knowledge", image: knowledge, alt: "Knowledge section showing editable questions and answers", caption: "Manage FAQs and documents so Assistly can answer questions using information your business provides." },
  { title: "Leads", image: leads, alt: "Lead list with customer interests and follow-up statuses", caption: "See what customers are interested in and update each lead’s status as your team follows up." },
  { title: "Services", image: services, alt: "Service catalogue with durations, prices, and active statuses", caption: "Manage what you offer, including each service’s price, duration, and availability in the catalogue." },
  { title: "Team availability", image: team, alt: "Team directory with a Schedule button for each provider", caption: "Open a team member’s schedule to manage weekly hours and exceptions such as time off or extra availability." },
  { title: "Appointments", image: appointments, alt: "Appointment book with booking statuses and Move and Cancel actions", caption: "See who booked what and when. Staff can create, reschedule, or cancel appointments from the appointment book." },
];

const capabilities = [
  { icon: BookOpen, title: "Answer questions", text: "Give customers answers about your services, pricing, and policies using the information you provide." },
  { icon: CalendarDays, title: "Capture enquiries and handle bookings", text: "Collect details for follow-up and help customers find an available time they can confirm in chat." },
  { icon: MessagesSquare, title: "Keep staff in control", text: "Give your team the conversation history and the option to step in when a customer needs a person." },
];

export default function Demo() {
  const [index, setIndex] = useState(0);
  const example = examples[index];

  return (
    <div className="assistly-demo">
      <a className="skip-link" href="#demo-main">Skip to content</a>
      <header className="demo-header" id="demo-top">
        <div className="demo-width">
          <a className="brand" href="#demo-top" aria-label="Assistly demo home">assistly<span className="brand-dot">.</span></a>
          <nav aria-label="Demo sections">
            <a href="#demo-video">Watch demo</a>
            <a href="#demo-workspace">Workspace</a>
          </nav>
        </div>
      </header>
      <main className="demo-width" id="demo-main">
        <section className="demo-hero" aria-labelledby="demo-heading">
          <h1 id="demo-heading">AI customer support<br className="demo-break" /> for your business.</h1>
          <p>Assistly answers customer questions using your FAQs and documents, helps people explore your services, captures leads, and handles booking requests. Your team can review conversations, take over when needed, and follow up from one workspace.</p>
          <a className="demo-primary" href="#demo-video">Watch the demo <ArrowDown size={17} aria-hidden="true" /></a>
        </section>
        <ul className="demo-capabilities" aria-label="What Assistly does">
          {capabilities.map(({ icon: Icon, title, text }) => (
            <li className="panel" key={title}>
              <span className="demo-icon"><Icon size={20} aria-hidden="true" /></span>
              <h2>{title}</h2>
              <p>{text}</p>
            </li>
          ))}
        </ul>
        <section className="demo-section" id="demo-video" aria-labelledby="demo-video-heading">
          <h2 id="demo-video-heading">Watch a customer book through chat</h2>
          <p>Follow a sample booking at Jubilee Family Clinic, from the first message to confirmation.</p>
          <video controls playsInline preload="metadata" aria-labelledby="demo-video-heading">
            <source src={video} type="video/mp4" />
            <a href={video}>Open the demo recording</a>
          </video>
        </section>
        <section className="demo-section" id="demo-workspace" aria-labelledby="demo-workspace-heading">
          <h2 id="demo-workspace-heading">Explore the workspace</h2>
          <p>Sample screens from the Jubilee Family Clinic workspace.</p>
          <div className="panel demo-gallery">
            <div className="demo-selectors" role="group" aria-label="Workspace examples">
              {examples.map(({ title }, position) => (
                <button key={title} type="button" aria-pressed={position === index} onClick={() => setIndex(position)}>{title}</button>
              ))}
            </div>
            <figure>
              <img src={example.image} alt={example.alt} width="1264" height="583" />
              <figcaption aria-live="polite">
                <h3>{example.title}</h3>
                <p>{example.caption}</p>
              </figcaption>
            </figure>
            <div className="demo-gallery-actions">
              <div className="demo-pagination" role="group" aria-label="Browse screenshots">
                <button type="button" aria-label="Previous screenshot" onClick={() => setIndex((index + examples.length - 1) % examples.length)}><ArrowLeft size={17} aria-hidden="true" /></button>
                <span>{index + 1} / {examples.length}</span>
                <button type="button" aria-label="Next screenshot" onClick={() => setIndex((index + 1) % examples.length)}><ArrowRight size={17} aria-hidden="true" /></button>
              </div>
              <a href={example.image} target="_blank" rel="noopener" aria-label={`Open full-size ${example.title} screenshot in a new tab`}><Maximize2 size={16} aria-hidden="true" /> View full size</a>
            </div>
          </div>
        </section>
      </main>
      <footer className="demo-width"><a href="#demo-top">Back to top</a></footer>
    </div>
  );
}


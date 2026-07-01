import { IconX } from '@tabler/icons-react'
import './PhotoLightbox.css'

export default function PhotoLightbox({ src, onClose }) {
  if (!src) return null
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}><IconX size={26} /></button>
      <img src={src} alt="Full size" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
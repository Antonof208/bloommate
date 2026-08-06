import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IconPlant2, IconPlus, IconTrophy, IconUser } from '@tabler/icons-react'

export default function BottomNav({ active }) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <nav className="bottom-nav">
      <button className={`nav-item ${active === 'home' ? 'active' : ''}`} onClick={() => navigate('/')}>
        <IconPlant2 size={24} />
        <span>{t('nav.plants')}</span>
      </button>

      <button className="nav-add" onClick={() => navigate('/add')}>
        <div className="nav-add-icon">
          <IconPlus size={26} />
        </div>
        <span>{t('nav.add')}</span>
      </button>

      <button className={`nav-item ${active === 'wins' ? 'active' : ''}`} onClick={() => navigate('/wins')}>
        <IconTrophy size={24} />
        <span>{t('nav.wins')}</span>
      </button>

      <button className={`nav-item ${active === 'profile' ? 'active' : ''}`} onClick={() => navigate('/profile')}>
        <IconUser size={24} />
        <span>{t('nav.profile')}</span>
      </button>
    </nav>
  )
}

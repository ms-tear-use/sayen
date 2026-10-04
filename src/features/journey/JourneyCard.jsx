import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import IconButton from '../../components/IconButton'
import { useSpace } from '../auth/hooks'
import { inferType } from '../space/events'
import { supabase } from '../../supabaseClient'
import JourneyHero from './JourneyHero'
import { journeyTitle } from './journey'

export default function JourneyCard() {
  const { space } = useSpace()
  const [milestones, setMilestones] = useState([])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      supabase
        .from('important_dates')
        .select('id, title, event_date, event_type, occurrence_date')
        .eq('space_id', space.id)
        .then((result) => {
          if (!active || result.error) return
          setMilestones((result.data || []).filter((item) => inferType(item) === 'milestone' && !item.occurrence_date))
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [space.id])

  const linked = milestones.find((item) => item.id === space.journey_date_id) || null
  const startKey = String(linked?.event_date || space.journey_started_on || '').slice(0, 10)
  const title = journeyTitle(space.journey_name)

  return (
    <section className="home-card journey-card" aria-label={title}>
      <div className="page-header--row">
        <h2>{title}</h2>
        <IconButton label="Open timeline" to="/journey"><ChevronRight size={20} aria-hidden="true" /></IconButton>
      </div>
      {startKey ? (
        <JourneyHero dateKey={startKey} />
      ) : (
        <Link to="/journey" className="journey-empty">Add the day you started, or link an anniversary.</Link>
      )}
    </section>
  )
}

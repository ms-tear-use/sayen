import { useCallback, useEffect, useState } from 'react'
import ErrorMessage from '../../components/ErrorMessage'
import GoalBoard from './GoalBoard'
import GoalTree from './GoalTree'
import LoadingState from '../../components/LoadingState'
import { useAuth, useSpace } from '../auth/hooks'
import { friendlyError } from '../../lib/errors'
import { isMissingSchema, schemaHint } from '../../lib/schema'
import { todayKey } from '../space/dates'
import { supabase } from '../../supabaseClient'

const categoryDefaults = [
  'Places to Visit',
  'Movies to Watch',
  'Things to Do',
  'Things to Buy',
  'Future Plans',
]

export default function GoalsSection() {
  const { user } = useAuth()
  const { space, members } = useSpace()
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [goals, setGoals] = useState([])
  const [limited, setLimited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const goalResult = await supabase
      .from('shared_goals')
      .select('id, title, complete, user_id, subcategory_id, target_date, completed_on, created_at')
      .eq('space_id', space.id)
      .order('created_at', { ascending: true })

    if (goalResult.error && isMissingSchema(goalResult.error)) {
      const basic = await supabase
        .from('shared_goals')
        .select('id, title, complete, user_id, created_at')
        .eq('space_id', space.id)
        .order('created_at', { ascending: true })
      if (basic.error) throw basic.error
      setGoals(basic.data || [])
      setLimited(true)
      return
    }
    if (goalResult.error) throw goalResult.error

    let categoryResult = await supabase
      .from('goal_categories')
      .select('id, name, position')
      .eq('space_id', space.id)
      .order('position', { ascending: true })

    if (categoryResult.error && isMissingSchema(categoryResult.error)) {
      setGoals(goalResult.data || [])
      setLimited(true)
      return
    }
    if (categoryResult.error) throw categoryResult.error

    if ((categoryResult.data || []).length === 0) {
      const { error: seedError } = await supabase.from('goal_categories').insert(
        categoryDefaults.map((name, position) => ({ space_id: space.id, name, position })),
      )
      if (seedError && seedError.code !== '23505') throw seedError
      categoryResult = await supabase
        .from('goal_categories')
        .select('id, name, position')
        .eq('space_id', space.id)
        .order('position', { ascending: true })
      if (categoryResult.error) throw categoryResult.error
    }

    const subResult = await supabase
      .from('goal_subcategories')
      .select('id, category_id, name, target_date, completed_on, complete, position')
      .eq('space_id', space.id)
      .order('position', { ascending: true })
    if (subResult.error) throw subResult.error

    setCategories(categoryResult.data || [])
    setSubcategories(subResult.data || [])
    setGoals(goalResult.data || [])
    setLimited(false)
  }, [space.id])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      load()
        .catch((loadError) => {
          if (active) setError(friendlyError(loadError, "We couldn't load goals."))
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [load])

  const saveCategory = async (form) => {
    const query = form.id
      ? supabase.from('goal_categories').update({ name: form.name }).eq('id', form.id).eq('space_id', space.id)
      : supabase.from('goal_categories').insert({ space_id: space.id, name: form.name, position: categories.length })
    const { error: saveError } = await query
    if (saveError) throw new Error(friendlyError(saveError, "We couldn't save that category."))
    await load()
  }

  const deleteCategory = async (id) => {
    const { error: deleteError } = await supabase.from('goal_categories').delete().eq('id', id).eq('space_id', space.id)
    if (deleteError) {
      setError(friendlyError(deleteError, "We couldn't delete that category."))
      return
    }
    await load()
  }

  const saveSubcategory = async (form) => {
    const payload = {
      name: form.name,
      target_date: form.target_date,
      completed_on: form.completed_on,
      complete: form.complete,
    }
    const query = form.id
      ? supabase.from('goal_subcategories').update(payload).eq('id', form.id).eq('space_id', space.id)
      : supabase.from('goal_subcategories').insert({ ...payload, space_id: space.id, category_id: form.category_id, position: subcategories.length })
    const { error: saveError } = await query
    if (saveError) throw new Error(friendlyError(saveError, "We couldn't save that subcategory."))
    await load()
  }

  const deleteSubcategory = async (id) => {
    const { error: deleteError } = await supabase.from('goal_subcategories').delete().eq('id', id).eq('space_id', space.id)
    if (deleteError) {
      setError(friendlyError(deleteError, "We couldn't delete that subcategory."))
      return
    }
    await load()
  }

  const saveGoal = async (form) => {
    const payload = {
      title: form.title,
      subcategory_id: form.subcategory_id || null,
      target_date: form.target_date || null,
      completed_on: form.completed_on || null,
      complete: Boolean(form.complete),
    }
    const query = form.id
      ? supabase.from('shared_goals').update(payload).eq('id', form.id).eq('space_id', space.id)
      : supabase.from('shared_goals').insert({ ...payload, space_id: space.id, user_id: user.id })
    const { error: saveError } = await query
    if (saveError) throw new Error(friendlyError(saveError, "We couldn't save that goal."))
    await load()
  }

  const toggleGoal = async (goal) => {
    const complete = !goal.complete
    const payload = limited
      ? { complete }
      : { complete, completed_on: complete ? (goal.completed_on || todayKey()) : null }
    const { error: saveError } = await supabase.from('shared_goals').update(payload).eq('id', goal.id).eq('space_id', space.id)
    if (saveError) {
      setError(friendlyError(saveError, "We couldn't update that goal."))
      return
    }
    setGoals((current) => current.map((item) => (item.id === goal.id ? { ...item, ...payload } : item)))
  }

  const deleteGoal = async (id) => {
    const { error: deleteError } = await supabase.from('shared_goals').delete().eq('id', id).eq('space_id', space.id)
    if (deleteError) {
      setError(friendlyError(deleteError, "We couldn't delete that goal."))
      return
    }
    setGoals((current) => current.filter((goal) => goal.id !== id))
  }

  if (loading) return <LoadingState compact message="Loading goals..." />

  return (
    <div>
      <ErrorMessage message={error} />
      {limited ? (
        <>
          <p className="muted">{schemaHint}</p>
          <GoalBoard
            goals={goals}
            onSave={async (form) => {
              const query = form.id
                ? supabase.from('shared_goals').update({ title: form.title }).eq('id', form.id).eq('space_id', space.id)
                : supabase.from('shared_goals').insert({ space_id: space.id, user_id: user.id, title: form.title, complete: false })
              const { error: saveError } = await query
              if (saveError) throw new Error(friendlyError(saveError, "We couldn't save that goal."))
              await load()
            }}
            onToggle={toggleGoal}
            onDelete={deleteGoal}
          />
        </>
      ) : (
        <GoalTree
          categories={categories}
          subcategories={subcategories}
          goals={goals}
          members={members}
          currentUserId={user.id}
          onSaveCategory={saveCategory}
          onDeleteCategory={deleteCategory}
          onSaveSubcategory={saveSubcategory}
          onDeleteSubcategory={deleteSubcategory}
          onSaveGoal={saveGoal}
          onToggleGoal={toggleGoal}
          onDeleteGoal={deleteGoal}
        />
      )}
    </div>
  )
}

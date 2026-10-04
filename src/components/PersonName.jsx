import { memberName } from '../lib/helpers'

export default function PersonName({ members, userId, currentUserId }) {
  return (
    <>
      {memberName(members, userId)}
      {userId === currentUserId && <span className="you-mark"> (you)</span>}
    </>
  )
}

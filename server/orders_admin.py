"""
Update order status so customers see it on their Account page.

  python orders_admin.py list
  python orders_admin.py status 3F9A1C2B making
  python orders_admin.py status 3F9A1C2B shipped 9400111202555842332669   (USPS tracking number)

Statuses: paid, making, shipped, delivered, refunded, canceled
The order number is the 8 characters customers see (or the full Stripe id).

On CasaOS:  docker exec -it peelworks-server python orders_admin.py list
"""
import sys

import accounts

accounts.init_db()
args = sys.argv[1:]
if not args or args[0] == "list":
    rows = accounts.db().execute("SELECT * FROM orders ORDER BY created DESC LIMIT 50").fetchall()
    for r in rows:
        print(f"{r['id'][-8:].upper()}  {r['created']}  {r['status']:<9}  ${r['total_cents']/100:>7.2f}  {r['email']}")
    if not rows:
        print("No orders yet.")
elif args[0] == "status" and len(args) >= 3:
    oid = accounts.set_status(args[1], args[2], args[3] if len(args) > 3 else None)
    print(f"Updated {oid[-8:].upper()} -> {args[2]}")
else:
    print(__doc__)

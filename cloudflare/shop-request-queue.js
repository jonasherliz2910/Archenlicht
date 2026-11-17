// Podbase downloads the print file while POST /orders is still pending.
// File reads must never wait behind the request/alarm making that POST.
// Only immutable print assets bypass the queue; all business requests and
// alarms remain serialized. Print cache inserts are conflict-safe.
export class ShopRequestQueue {
  tail = Promise.resolve();
  serial(work) {
    const task = this.tail.then(work);
    this.tail = task.catch(() => {});
    return task;
  }
  fetch(request, work) {
    const immutablePrint = ['GET', 'HEAD'].includes(request.method)
      && /^\/prints\/[a-f0-9]{64}\.(png|svg|preview\.svg)$/.test(new URL(request.url).pathname);
    return immutablePrint ? Promise.resolve().then(work) : this.serial(work);
  }
}

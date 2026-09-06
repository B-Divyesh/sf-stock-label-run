# Stock Label Run demo

- Demo URL: /demo at the product origin.
- The landing-page Try it with sample data action opens that URL in one click.
- The sample is a realistic nine-label receiving run: Cedar soap, Small canvas
  pouch, and Repair kit. It immediately shows checked rows, a print proof, and
  the receipt workflow.
- Demo state uses the IndexedDB database demo:stock-label-run. Real state uses
  stock-label-run; the demo never reads or writes that database.
- The persistent banner says “Demo — sample data, nothing is saved.” Reset demo
  deletes and reseeds only demo:stock-label-run. Start for real deletes demo
  data and returns to /.

The claim suite exercises the demo from fresh browser contexts. It checks the
separate database name, populated output, reset action, and preservation of a
real draft when leaving the demo.

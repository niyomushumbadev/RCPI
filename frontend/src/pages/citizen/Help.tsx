import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const steps = [
  'Open the report form and choose the category that matches your issue.',
  'Add a clear explanation with what happened, where it happened, and how it affects the community.',
  'Add photos or supporting evidence so officials can confirm the problem.',
  'Use your current location or adjust it on the map to mark the exact place.',
  'Review the report and submit it. You will receive a reference number and status updates.',
];

export default function Help() {
  const { user } = useAuth();
  const isCitizen = !user || user.role === 'CITIZEN';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={isCitizen ? 'Citizen help' : 'Staff help'}
        subtitle={isCitizen
          ? 'Simple guidance for making reports, checking updates, and using the portal.'
          : 'Guidance for reviewing, verifying and resolving community reports.'}
      />

      <div className="card space-y-5 p-6">
        <section>
          <h2 className="text-lg font-bold text-slate-900">How to report a problem</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">What information helps most</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>Report title and a short, clear description.</li>
            <li>Category, district, sector, and a nearby landmark or known place.</li>
            <li>Photos that show the issue and the area affected.</li>
            <li>Location details so officials can visit the right place.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Why location is needed</h2>
          <p className="mt-3 text-sm text-slate-600">
            Your location helps authorities identify where the reported problem is located. We only collect the location required to address the issue and we do not publicly share your personal location.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">How to track progress</h2>
          <p className="mt-3 text-sm text-slate-600">
            After submission, you can view your reports from My Reports and check notifications for updates such as review, assignment, progress, and resolution.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Report statuses</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm text-slate-600">
            <div className="rounded-lg border border-slate-200 p-3"><strong>Submitted:</strong> your report has been received.</div>
            <div className="rounded-lg border border-slate-200 p-3"><strong>Under review:</strong> staff are checking the report.</div>
            <div className="rounded-lg border border-slate-200 p-3"><strong>In progress:</strong> action is being taken.</div>
            <div className="rounded-lg border border-slate-200 p-3"><strong>Resolved:</strong> the issue has been addressed.</div>
          </div>
        </section>

        <div className="flex justify-end">
          <Link to={isCitizen ? '/citizen/reports' : '/workflow/reports'} className="btn-primary">
            {isCitizen ? 'Go to My Reports' : 'Go to the reports queue'}
          </Link>
        </div>
      </div>
    </div>
  );
}

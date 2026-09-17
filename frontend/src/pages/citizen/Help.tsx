import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../translations';

export default function Help() {
  const { user } = useAuth();
  const isCitizen = !user || user.role === 'CITIZEN';

  const steps = [
    t('citizen.createSubtitle'),
    t('citizen.descriptionPlaceholder'),
    t('citizen.evidenceHint'),
    t('citizen.locationDescriptionPlaceholder'),
    t('citizen.reportSubmittedHint'),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={isCitizen ? t('citizen.helpTitle') : t('citizen.helpTitle')}
        subtitle={isCitizen
          ? t('citizen.dashboardSubtitle')
          : t('workflow.dashboardSubtitle')}
      />

      <div className="card space-y-5 p-6">
        <section>
          <h2 className="text-lg font-bold text-slate-900">{t('citizen.createTitle')}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">{t('citizen.descriptionLabel')}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>{t('citizen.titleLabel')} · {t('citizen.descriptionLabel')}</li>
            <li>{t('citizen.categoryLabel')} · {t('citizen.districtLabel')} · {t('citizen.locationDescriptionLabel')}</li>
            <li>{t('citizen.evidenceLabel')}</li>
            <li>{t('citizen.gpsLabel')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">{t('citizen.gpsLabel')}</h2>
          <p className="mt-3 text-sm text-slate-600">
            {t('citizen.anonymousHint')}
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">{t('citizen.timeline')}</h2>
          <p className="mt-3 text-sm text-slate-600">
            {t('citizen.myReportsSubtitle')}
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">{t('admin.status')}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm text-slate-600">
            <div className="rounded-lg border border-slate-200 p-3"><strong>{t('status.SUBMITTED')}</strong></div>
            <div className="rounded-lg border border-slate-200 p-3"><strong>{t('status.UNDER_REVIEW')}</strong></div>
            <div className="rounded-lg border border-slate-200 p-3"><strong>{t('status.IN_PROGRESS')}</strong></div>
            <div className="rounded-lg border border-slate-200 p-3"><strong>{t('status.RESOLVED')}</strong></div>
          </div>
        </section>

        <div className="flex justify-end">
          <Link to={isCitizen ? '/citizen/reports' : '/workflow/reports'} className="btn-primary">
            {isCitizen ? t('nav.myReports') : t('nav.reportsQueue')}
          </Link>
        </div>
      </div>
    </div>
  );
}

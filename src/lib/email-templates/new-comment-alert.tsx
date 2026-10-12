import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  authorName?: string
  clientName?: string
  projectTitle?: string
  body?: string
  timecode?: string
}

const Email = ({ authorName, clientName, projectTitle, body, timecode }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouveau retour de {authorName || 'votre client'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>SKYRUSH972</Text>
        <Heading style={h1}>Nouveau retour client</Heading>
        <Text style={meta}>
          {authorName || 'Un client'}{clientName ? ` · ${clientName}` : ''} — {projectTitle || 'Projet'}
        </Text>
        <Section style={quote}>
          {timecode ? <Text style={tc}>▶ {timecode}</Text> : null}
          <Text style={text}>{body || ''}</Text>
        </Section>
        <Text style={footer}>Ouvrez votre console Skyrush972 pour répondre.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d) => `Nouveau retour sur ${d['projectTitle'] || 'un projet'}`,
  displayName: 'Alerte nouveau commentaire',
  to: 'skyrush972@hotmail.com',
  previewData: { authorName: 'Davy S.', clientName: 'elsa', projectTitle: 'Fetes des voisins', body: 'Superbe plan au début !', timecode: '1:24' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '28px 25px', maxWidth: '560px' }
const brand = { color: '#c9a24a', fontSize: '12px', letterSpacing: '3px', margin: 0 }
const h1 = { color: '#0b1526', fontStyle: 'italic', fontSize: '26px', margin: '8px 0 4px' }
const meta = { color: '#555', fontSize: '14px', fontFamily: 'Arial, sans-serif' }
const quote = { borderLeft: '3px solid #c9a24a', padding: '4px 16px', margin: '16px 0' }
const tc = { color: '#c9a24a', fontSize: '13px', fontFamily: 'monospace', margin: '0 0 4px' }
const text = { color: '#0b1526', fontSize: '15px', lineHeight: '22px', fontFamily: 'Arial, sans-serif', margin: 0 }
const footer = { color: '#888', fontSize: '12px', fontFamily: 'Arial, sans-serif' }

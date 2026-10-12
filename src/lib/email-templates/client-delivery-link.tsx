import React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  projectTitle?: string
  link?: string
}

const Email = ({ clientName, projectTitle, link }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre livraison vidéo « {projectTitle || 'votre projet'} » est disponible</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>SKYRUSH972</Text>
        <Heading style={h1}>Votre livraison est prête</Heading>
        <Text style={text}>Bonjour {clientName || ''},</Text>
        <Text style={text}>
          Les vidéos de votre projet <strong>{projectTitle || ''}</strong> sont disponibles dans votre espace
          de livraison privé. Vous pouvez les visionner et laisser vos commentaires directement à l'instant
          précis de la vidéo.
        </Text>
        <Section style={{ margin: '28px 0' }}>
          <Button href={link} style={button}>Voir ma livraison</Button>
        </Section>
        <Text style={small}>Ou copiez ce lien dans votre navigateur :<br />{link}</Text>
        <Hr style={hr} />
        <Text style={small}>
          Le téléchargement des fichiers sera débloqué une fois le paiement effectué.<br />
          Merci pour votre confiance — Skyrush972, vidéaste drone en Martinique.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d) => `Votre livraison vidéo « ${d['projectTitle'] || 'Skyrush972'} » est disponible`,
  displayName: 'Lien de livraison client',
  previewData: { clientName: 'Elsa', projectTitle: 'Fête des voisins', link: 'https://client.skyrush972.fr/lien/abc' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }
const container = { padding: '28px 25px', maxWidth: '560px' }
const brand = { color: '#c9a24a', fontSize: '12px', letterSpacing: '3px', margin: 0 }
const h1 = { color: '#0b1526', fontStyle: 'italic', fontSize: '26px', margin: '8px 0 16px' }
const text = { color: '#0b1526', fontSize: '15px', lineHeight: '23px', fontFamily: 'Arial, sans-serif' }
const button = { backgroundColor: '#0b1526', color: '#e8c873', padding: '14px 26px', borderRadius: '6px', fontFamily: 'Arial, sans-serif', fontSize: '15px', textDecoration: 'none' }
const small = { color: '#777', fontSize: '12px', lineHeight: '18px', fontFamily: 'Arial, sans-serif', wordBreak: 'break-all' as const }
const hr = { borderColor: '#eee', margin: '24px 0' }
